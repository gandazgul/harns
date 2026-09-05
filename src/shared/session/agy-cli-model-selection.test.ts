import { assert, assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { AGENTS } from "../../constants.js";
import { runModelsCommand } from "../../cmd/models/index.ts";
import { withRuntimeCommandFixture } from "../../cmd/testing/runtime-command-fixture.ts";
import { assertModelExecutionBackendSupported } from "../models/model-execution.ts";
import { getModelRegistry } from "../models/model-registry.ts";
import { getSettingsManager } from "../settings.js";
import { installAgyCliMcpSetup } from "./backends/agy-cli/mcp-setup.ts";
import { SessionHost } from "./session-host.js";
import { createSessionRuntime, SessionRuntime } from "./session-runtime.js";

const FIXTURE_MODEL = "runtime-command-fixture/fixture-model";

async function installAgyModelSelectionFixture(homeDir: string): Promise<string> {
    const binDir = join(homeDir, "agy-bin");
    await Deno.mkdir(binDir, { recursive: true });
    await Deno.writeTextFile(join(binDir, "wld"), "#!/bin/sh\necho wld fixture\n");
    await Deno.chmod(join(binDir, "wld"), 0o755);
    const agySource = String.raw`
function readArg(args: string[], flag: string): string {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] || "" : "";
}
function joinPath(...parts: string[]): string {
    return parts.map((part, index) => {
        const trimmed = index === 0 ? part.replace(/\/+$/, "") : part.replace(/^\/+|\/+$/g, "");
        return trimmed;
    }).filter(Boolean).join("/");
}
const prompt = readArg(Deno.args, "-p");
const outputFormat = readArg(Deno.args, "--output-format");
if (prompt === "/agents" && outputFormat === "json") {
    const agentsRoot = joinPath(Deno.env.get("HOME") || "", ".gemini", "config", "agents");
    const agents: Array<{ name: string }> = [];
    try {
        for await (const entry of Deno.readDir(agentsRoot)) {
            if (entry.isDirectory) agents.push({ name: entry.name });
        }
    } catch {
        // No agents directory yet.
    }
    console.log(JSON.stringify({ agents }));
    Deno.exit(0);
}
Deno.exit(0);
`;
    const agyPath = join(binDir, "agy-fixture.ts");
    await Deno.writeTextFile(agyPath, agySource);
    await Deno.writeTextFile(join(binDir, "agy"), `#!/bin/sh\nexec deno run -A ${JSON.stringify(agyPath)} "$@"\n`);
    await Deno.chmod(join(binDir, "agy"), 0o755);
    return binDir;
}

Deno.test("configured Agy CLI model is registered and accepted by typed execution backend dispatch", () => {
    const model = getModelRegistry().find("agy-cli", `selection-${crypto.randomUUID()}`);
    assert(model);
    assertModelExecutionBackendSupported(model);
});

Deno.test("declined Agy MCP setup keeps the selected model without launching agy", async () => {
    await withRuntimeCommandFixture("runwield-agy-cli-setup-decline-", async ({ homeDir, projectRoot }) => {
        let runtime: SessionRuntime | null = null;
        const agyLaunchLog = join(homeDir, "agy-launched.log");
        const previousPath = Deno.env.get("PATH") || "";
        try {
            const binDir = await installAgyModelSelectionFixture(homeDir);
            await Deno.writeTextFile(
                join(binDir, "agy"),
                `#!/bin/sh\necho launched >> ${JSON.stringify(agyLaunchLog)}\nexit 2\n`,
            );
            await Deno.chmod(join(binDir, "agy"), 0o755);
            Deno.env.set("PATH", `${binDir}:${previousPath}`);

            const sessionHost = new SessionHost();
            const hostedSession = sessionHost.createSession({ cwd: projectRoot });
            hostedSession.setActiveModelState("fixture-model", "runtime-command-fixture", true);
            hostedSession.setRootAgentName(AGENTS.GUIDE);
            runtime = new SessionRuntime({
                sessionHost,
                sessionStore: null,
                ownerProcessKind: "test",
                ownerInstanceId: "agy-setup-decline-test",
            });
            let interactionCount = 0;
            hostedSession.setInteractionAdapter({
                requestInteraction: () => {
                    interactionCount += 1;
                    return { outcome: "accepted", value: "decline" };
                },
                supportsInteraction: () => true,
            });

            const modelId = `declined-${crypto.randomUUID()}`;
            const activeRuntime = runtime;
            await assertRejects(
                () => activeRuntime.reconfigureSessionModel(hostedSession.id, modelId, "agy-cli"),
                Error,
                "not approved",
            );
            assertEquals(interactionCount, 1);
            assertEquals(runtime.getSessionSnapshot(hostedSession.id)?.activeModel, {
                model: modelId,
                provider: "agy-cli",
            });
            await assertRejects(() => Deno.stat(agyLaunchLog), Deno.errors.NotFound);
        } finally {
            Deno.env.set("PATH", previousPath);
            runtime?.closeAllSessions();
        }
    });
});

Deno.test("explicit Agy CLI selection persists and updates the active runtime Session model", async () => {
    await withRuntimeCommandFixture("runwield-agy-cli-selection-", async ({ homeDir, projectRoot }) => {
        const runtime = createSessionRuntime();
        const messages: string[] = [];
        const modelId = `session-${crypto.randomUUID()}`;
        const previousPath = Deno.env.get("PATH") || "";
        try {
            const binDir = await installAgyModelSelectionFixture(homeDir);
            Deno.env.set("PATH", `${binDir}:${previousPath}`);
            await installAgyCliMcpSetup();
            const { sessionId } = await runtime.createInteractiveSession({ cwd: projectRoot, mode: "new" });
            await runModelsCommand([FIXTURE_MODEL], {
                uiAPI: {
                    appendSystemMessage: (message) => messages.push(message),
                    promptSelect: () => Promise.resolve(null),
                },
                sessionId,
                sessionRuntime: runtime,
            });
            assertEquals(runtime.getSessionSnapshot(sessionId)?.activeModel, {
                model: "fixture-model",
                provider: "runtime-command-fixture",
            });
            const firstTurn = await runtime.promptUserTurn(sessionId, { initialRequest: "Prime the fixture model" });
            assertEquals(firstTurn.ok, true);
            assertEquals((await runtime.switchAgent(sessionId, { agentName: AGENTS.GUIDE })).ok, true);
            messages.length = 0;

            await runModelsCommand([`agy-cli/${modelId}`], {
                uiAPI: {
                    appendSystemMessage: (message) => messages.push(message),
                    promptSelect: () => Promise.resolve(null),
                },
                sessionId,
                sessionRuntime: runtime,
            });

            assertEquals(runtime.getSessionSnapshot(sessionId)?.activeModel, {
                model: modelId,
                provider: "agy-cli",
            });
            assertEquals(getSettingsManager(projectRoot).getDefaultProvider(), "agy-cli");
            assertEquals(getSettingsManager(projectRoot).getDefaultModel(), modelId);
            assertStringIncludes(messages.at(-1) || "", `Switched model to agy-cli/${modelId}`);
        } finally {
            Deno.env.set("PATH", previousPath);
            runtime.closeAllSessions();
        }
    });
});
