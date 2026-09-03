import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { AGENTS } from "../../constants.js";
import { withProcessGlobalTestLock } from "../../testing/process-global-lock.js";
import { HostedSession } from "./hosted-session.js";
import { getRootSessionBranchEntries } from "./root-session.js";
import {
    abortActiveSession,
    ensureRootAgentSession,
    runIsolatedAgentSession,
    runRootTurn,
    steerRootSession,
} from "./session.js";

interface AgyFixtureCall {
    args: string[];
    prompt: string;
    agent: string;
    model: string;
    definition: string;
}

interface RuntimeEventRecord {
    type?: string;
    agentName?: string;
    delta?: string;
}

interface AgyRootRef {
    kind: "agy-cli";
    session: {
        isStreaming: boolean;
        dispose(): Promise<void>;
    };
}

interface BranchEntryRecord {
    type?: string;
    customType?: string;
    message?: { role?: string };
}

async function removeTempDir(path: string): Promise<void> {
    await Deno.remove(path, { recursive: true }).catch(() => undefined);
}

async function installAgyExecutionFixture(binDir: string, logPath: string): Promise<void> {
    await Deno.mkdir(binDir, { recursive: true });
    const fixturePath = join(binDir, "fake-agy-execution.ts");
    const fixtureSource = String.raw`
interface JsonRecord {
    [key: string]: string | number | boolean | JsonRecord | string[] | JsonRecord[];
}

function readArg(args: string[], flag: string): string {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] || "" : "";
}

function hasArg(args: string[], flag: string): boolean {
    return args.includes(flag);
}

function joinPath(...parts: string[]): string {
    return parts.map((part, index) => {
        const trimmed = index === 0 ? part.replace(/\/+$/, "") : part.replace(/^\/+|\/+$/g, "");
        return trimmed;
    }).filter(Boolean).join("/");
}

async function fileExists(path: string): Promise<boolean> {
    try {
        const info = await Deno.lstat(path);
        return info.isFile && !info.isSymlink;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) return false;
        throw error;
    }
}

function emit(value: JsonRecord): void {
    console.log(JSON.stringify(value));
}

async function main(): Promise<void> {
    const args = Deno.args;
    const home = Deno.env.get("HOME") || "";
    const prompt = readArg(args, "-p");
    const outputFormat = readArg(args, "--output-format");
    if (prompt === "/agents" && outputFormat === "json") {
        if (Deno.env.get("RUNWIELD_AGY_FAIL_AGENTS") === "1") Deno.exit(3);
        const agentsRoot = joinPath(home, ".gemini", "config", "agents");
        const agents: JsonRecord[] = [];
        try {
            for await (const entry of Deno.readDir(agentsRoot)) {
                if (entry.isDirectory && await fileExists(joinPath(agentsRoot, entry.name, "agent.md"))) {
                    agents.push({ name: entry.name });
                }
            }
        } catch {
            // No agents directory yet.
        }
        console.log(JSON.stringify({ agents }));
        return;
    }

    const logPath = Deno.env.get("RUNWIELD_AGY_EXECUTION_LOG") || "";
    const agent = readArg(args, "--agent");
    const model = readArg(args, "--model");
    const expectedModel = Deno.env.get("RUNWIELD_AGY_EXPECTED_MODEL") || "";
    if (!agent || !agent.startsWith("runwield-")) {
        console.error("missing owned agent");
        Deno.exit(2);
    }
    if (model !== expectedModel) {
        console.error("model mismatch: " + model);
        Deno.exit(2);
    }
    if (!hasArg(args, "--disable-slash-commands") || hasArg(args, "--conversation") || hasArg(args, "--continue") || hasArg(args, "--dangerously-skip-permissions")) {
        console.error("bad flags");
        Deno.exit(2);
    }
    const definitionPath = joinPath(home, ".gemini", "config", "agents", agent, "agent.md");
    const definition = await Deno.readTextFile(definitionPath);
    if (!definition.includes("Antigravity CLI backend limitations")) {
        console.error("missing backend note");
        Deno.exit(2);
    }
    if (prompt.includes("Antigravity CLI backend limitations") || prompt.includes("RunWield system prompt")) {
        console.error("system prompt leaked into user text");
        Deno.exit(2);
    }
    if (logPath) await Deno.writeTextFile(logPath, JSON.stringify({ args, prompt, agent, model, definition }) + "\n", { append: true, create: true });

    const resultText = prompt.includes("ASSISTANT: agy:first")
        ? "agy:second saw agy:first"
        : "agy:first plan_written task_completed review_complete";
    emit({ event: "init", conversation_id: "conversation-" + crypto.randomUUID(), init: { agent, model } });
    emit({ event: "step_update", step_update: { update_type: "tool_info", name: "display-only" } });
    emit({ event: "step_update", step_update: { step_type: "agent_response", text_delta: resultText.slice(0, 9) } });
    emit({ event: "step_update", step_update: { step_type: "agent_response", text_delta: resultText.slice(9) } });
    emit({ event: "result", result: { response: resultText, usage: { input_tokens: 17, output_tokens: 19 } } });
}

await main();
`;
    await Deno.writeTextFile(fixturePath, fixtureSource);
    const agyPath = join(binDir, "agy");
    await Deno.writeTextFile(agyPath, `#!/bin/sh\nexec deno run -A ${JSON.stringify(fixturePath)} "$@"\n`);
    await Deno.chmod(agyPath, 0o755);
    await Deno.writeTextFile(logPath, "");
}

async function withAgyExecutionFixture(
    callback: (home: string, cwd: string, logPath: string) => Promise<void>,
): Promise<void> {
    await withProcessGlobalTestLock(async () => {
        const previousHome = Deno.env.get("HOME");
        const previousPath = Deno.env.get("PATH");
        const previousLog = Deno.env.get("RUNWIELD_AGY_EXECUTION_LOG");
        const previousExpectedModel = Deno.env.get("RUNWIELD_AGY_EXPECTED_MODEL");
        const previousFailAgents = Deno.env.get("RUNWIELD_AGY_FAIL_AGENTS");
        const home = await Deno.makeTempDir({ prefix: "runwield-agy-exec-home-" });
        const cwd = join(home, "project");
        const binDir = join(home, "bin");
        const logPath = join(home, "agy-log.jsonl");
        try {
            await Deno.mkdir(cwd, { recursive: true });
            await installAgyExecutionFixture(binDir, logPath);
            Deno.env.set("HOME", home);
            Deno.env.set("PATH", `${binDir}:${previousPath || ""}`);
            Deno.env.set("RUNWIELD_AGY_EXECUTION_LOG", logPath);
            Deno.env.set("RUNWIELD_AGY_EXPECTED_MODEL", "fixture-model");
            Deno.env.delete("RUNWIELD_AGY_FAIL_AGENTS");
            await callback(home, cwd, logPath);
        } finally {
            if (previousHome === undefined) Deno.env.delete("HOME");
            else Deno.env.set("HOME", previousHome);
            if (previousPath === undefined) Deno.env.delete("PATH");
            else Deno.env.set("PATH", previousPath);
            if (previousLog === undefined) Deno.env.delete("RUNWIELD_AGY_EXECUTION_LOG");
            else Deno.env.set("RUNWIELD_AGY_EXECUTION_LOG", previousLog);
            if (previousExpectedModel === undefined) Deno.env.delete("RUNWIELD_AGY_EXPECTED_MODEL");
            else Deno.env.set("RUNWIELD_AGY_EXPECTED_MODEL", previousExpectedModel);
            if (previousFailAgents === undefined) Deno.env.delete("RUNWIELD_AGY_FAIL_AGENTS");
            else Deno.env.set("RUNWIELD_AGY_FAIL_AGENTS", previousFailAgents);
            await removeTempDir(home);
        }
    });
}

function createHostedSession(cwd: string, manager: SessionManager, events: RuntimeEventRecord[] = []): HostedSession {
    const hostedSession = new HostedSession({
        id: `hosted-${crypto.randomUUID()}`,
        cwd,
        sessionManager: manager as never,
        eventSink: (event: RuntimeEventRecord) => events.push(event),
    });
    hostedSession.setActiveModelState("fixture-model", "agy-cli", true);
    return hostedSession;
}

async function readCalls(logPath: string): Promise<AgyFixtureCall[]> {
    const text = await Deno.readTextFile(logPath);
    return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as AgyFixtureCall);
}

async function assertNoTemporaryAgents(home: string): Promise<void> {
    const agentsRoot = join(home, ".gemini", "config", "agents");
    const names: string[] = [];
    try {
        for await (const entry of Deno.readDir(agentsRoot)) names.push(entry.name);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) return;
        throw error;
    }
    assertEquals(names.filter((name) => name.startsWith("runwield-")).length, 0);
}

Deno.test("Agy CLI selected root turn dispatches through agy and rebuilds RunWield transcript history", async () => {
    await withAgyExecutionFixture(async (home, cwd, logPath) => {
        const manager = SessionManager.inMemory(cwd);
        const events: RuntimeEventRecord[] = [];
        const hostedSession = createHostedSession(cwd, manager, events);
        const root = await ensureRootAgentSession({ hostedSession, agentName: AGENTS.GUIDE }) as never as AgyRootRef;
        assertEquals(root.kind, "agy-cli");

        await runRootTurn({ hostedSession, agentName: AGENTS.GUIDE, userRequest: "first user marker" });
        await runRootTurn({ hostedSession, agentName: AGENTS.GUIDE, userRequest: "second user marker" });

        const calls = await readCalls(logPath);
        assertEquals(calls.length, 2);
        assertEquals(calls[0].model, "fixture-model");
        assertEquals(calls[0].args.includes("--disable-slash-commands"), true);
        assertEquals(calls[0].args.includes("--conversation"), false);
        assertEquals(calls[0].prompt.includes("first user marker"), true);
        assertEquals(calls[0].prompt.includes("Antigravity CLI backend limitations"), false);
        assertEquals(
            calls[1].prompt.includes("ASSISTANT: agy:first plan_written task_completed review_complete"),
            true,
        );
        assertEquals(calls[0].agent.startsWith("runwield-guide-"), true);

        const branch = getRootSessionBranchEntries(manager) as BranchEntryRecord[];
        const branchText = JSON.stringify(branch);
        assertStringIncludes(branchText, "agy:first plan_written task_completed review_complete");
        assertStringIncludes(branchText, "agy:second saw agy:first");
        assertEquals(branchText.includes(calls[0].agent), false);
        assertEquals(
            branch.filter((entry) => entry.type === "message" && entry.message?.role === "assistant").length,
            2,
        );
        assertEquals(
            branch.filter((entry) => entry.type === "custom" && entry.customType === "runwield.execution_backend")
                .length,
            4,
        );
        assertEquals(
            branch.some((entry) => entry.type === "custom" && String(entry.customType).includes("task_completion")),
            false,
        );
        assertEquals(
            events.some((event) => event.type === "assistant_text_delta" && event.agentName === "Guide"),
            true,
        );
        assertEquals(JSON.stringify(events).includes(calls[0].agent), false);

        await root.session.dispose();
        await assertNoTemporaryAgents(home);
    });
});

Deno.test("Agy CLI isolated turn uses its own temporary agent and cleans it up", async () => {
    await withAgyExecutionFixture(async (home, cwd, logPath) => {
        const manager = SessionManager.inMemory(cwd);
        const hostedSession = createHostedSession(cwd, manager);
        const messages = await runIsolatedAgentSession({
            hostedSession,
            agentName: AGENTS.GUIDE,
            userRequest: "isolated user marker",
            modelOverride: "agy-cli/fixture-model",
        });
        assertEquals(messages.at(-1)?.role, "assistant");
        assertStringIncludes(JSON.stringify(messages.at(-1)), "agy:first");
        assertEquals(getRootSessionBranchEntries(manager).length, 0);
        assertEquals(hostedSession.getRootAgentSession(), null);
        const calls = await readCalls(logPath);
        assertEquals(calls.length, 1);
        assertEquals(calls[0].prompt.includes("isolated user marker"), true);
        await assertNoTemporaryAgents(home);
    });
});

Deno.test("Agy CLI same-role roots use distinct temporary agents and clean up independently", async () => {
    await withAgyExecutionFixture(async (home, cwd) => {
        const firstCwd = join(cwd, "first");
        const secondCwd = join(cwd, "second");
        await Deno.mkdir(firstCwd, { recursive: true });
        await Deno.mkdir(secondCwd, { recursive: true });
        const firstManager = SessionManager.inMemory(firstCwd);
        const secondManager = SessionManager.inMemory(secondCwd);
        const firstHostedSession = createHostedSession(cwd, firstManager);
        const secondHostedSession = createHostedSession(cwd, secondManager);
        const firstRoot = await ensureRootAgentSession({
            hostedSession: firstHostedSession,
            agentName: AGENTS.GUIDE,
        }) as never as AgyRootRef;
        const secondRoot = await ensureRootAgentSession({
            hostedSession: secondHostedSession,
            agentName: AGENTS.GUIDE,
        }) as never as AgyRootRef;
        const agentsRoot = join(home, ".gemini", "config", "agents");
        const ownedNames: string[] = [];
        for await (const entry of Deno.readDir(agentsRoot)) {
            if (entry.name.startsWith("runwield-guide-")) ownedNames.push(entry.name);
        }
        assertEquals(ownedNames.length, 2);
        assertEquals(ownedNames[0] === ownedNames[1], false);

        await firstRoot.session.dispose();
        const remainingNames: string[] = [];
        for await (const entry of Deno.readDir(agentsRoot)) {
            if (entry.name.startsWith("runwield-guide-")) remainingNames.push(entry.name);
        }
        assertEquals(remainingNames.length, 1);
        await secondRoot.session.dispose();
        await assertNoTemporaryAgents(home);
    });
});

Deno.test("Agy CLI root setup failure keeps the previous root session usable", async () => {
    await withAgyExecutionFixture(async (home, cwd) => {
        const manager = SessionManager.inMemory(cwd);
        const hostedSession = createHostedSession(cwd, manager);
        const root = await ensureRootAgentSession({ hostedSession, agentName: AGENTS.GUIDE }) as never as AgyRootRef;
        Deno.env.set("RUNWIELD_AGY_FAIL_AGENTS", "1");
        await assertRejects(
            () =>
                ensureRootAgentSession({
                    hostedSession,
                    agentName: AGENTS.PLANNER,
                    modelOverride: "agy-cli/fixture-model",
                }),
            Error,
            "Could not prepare Antigravity custom agent for Planner",
        );
        assertEquals(hostedSession.getRootAgentSession() === root as never, true);
        assertEquals(hostedSession.getRootAgentName(), AGENTS.GUIDE);
        await root.session.dispose();
        await assertNoTemporaryAgents(home);
    });
});

Deno.test("Agy CLI root steering is not accepted without mutating transcript", async () => {
    await withAgyExecutionFixture(async (home, cwd) => {
        const manager = SessionManager.inMemory(cwd);
        const hostedSession = createHostedSession(cwd, manager);
        const root = await ensureRootAgentSession({ hostedSession, agentName: AGENTS.GUIDE }) as never as AgyRootRef;
        root.session.isStreaming = true;
        const steered = await steerRootSession(hostedSession, "steer me");
        root.session.isStreaming = false;
        assertEquals(steered, false);
        assertEquals(getRootSessionBranchEntries(manager).length, 2);
        await root.session.dispose();
        await assertNoTemporaryAgents(home);
    });
});

Deno.test("Agy CLI abort kills the active process", async () => {
    await withAgyExecutionFixture(async (home, cwd) => {
        const manager = SessionManager.inMemory(cwd);
        const hostedSession = createHostedSession(cwd, manager);
        const root = await ensureRootAgentSession({ hostedSession, agentName: AGENTS.GUIDE }) as never as AgyRootRef;
        root.session.isStreaming = true;
        assertEquals(abortActiveSession(hostedSession), true);
        root.session.isStreaming = false;
        await root.session.dispose();
        await assertNoTemporaryAgents(home);
    });
});
