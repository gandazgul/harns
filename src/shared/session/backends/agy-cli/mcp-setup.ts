import { basename, dirname, join, resolve } from "@std/path";
import { CLI_BIN, getHomeDir } from "../../../../constants.js";
import type { HostedSession } from "../../hosted-session.js";
import {
    isApprovalAcceptedValue,
    requestHostedSessionInteraction,
    RuntimeInteractionOutcomes,
    RuntimeInteractionTypes,
    supportsHostedSessionInteraction,
} from "../../session-runtime-interactions.js";

export const AGY_MCP_SERVER_NAME = "runwield" as const;
export const AGY_MCP_PERMISSION = "mcp(runwield/*)" as const;
export const AGY_MCP_ARGS = ["mcp", "agy-cli"] as const;

interface JsonMap {
    [key: string]: JsonValue;
}

type JsonValue = string | number | boolean | null | JsonValue[] | JsonMap;

type SetupStatus = {
    ok: boolean;
    repairable: boolean;
    message: string;
    configPath: string;
    settingsPath: string;
    command: string;
};

interface SetupPaths {
    configPath: string;
    settingsPath: string;
    lockPath: string;
}

interface EnsureAgyCliMcpSetupOptions {
    hostedSession?: HostedSession | null;
    signal?: AbortSignal;
}

function setupPaths(): SetupPaths {
    const home = getHomeDir();
    return {
        configPath: join(home, ".gemini", "config", "mcp_config.json"),
        settingsPath: join(home, ".gemini", "antigravity-cli", "settings.json"),
        lockPath: join(home, ".wld", "agy-mcp-setup.lock"),
    };
}

async function lstatOrNull(path: string): Promise<Deno.FileInfo | null> {
    try {
        return await Deno.lstat(path);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) return null;
        throw error;
    }
}

function isJsonMap(value: JsonValue | undefined): value is JsonMap {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseJsonMap(text: string, path: string): JsonMap {
    const value = JSON.parse(text) as JsonValue;
    if (!isJsonMap(value)) throw new Error(`${path} must contain a JSON object.`);
    return value;
}

async function readJsonMapOrEmpty(path: string): Promise<JsonMap> {
    const info = await lstatOrNull(path);
    if (!info) return {};
    if (info.isSymlink) throw new Error(`${path} must not be a symbolic link.`);
    if (!info.isFile) throw new Error(`${path} must be a regular file.`);
    return parseJsonMap(await Deno.readTextFile(path), path);
}

function jsonArrayContains(values: JsonValue | undefined, expected: string): boolean {
    return Array.isArray(values) && values.some((value) => value === expected);
}

function jsonArrayWithout(values: JsonValue | undefined, omitted: string): JsonValue[] {
    if (!Array.isArray(values)) return [];
    return values.filter((value) => value !== omitted);
}

function isExactRunWieldServer(value: JsonValue | undefined, wldPath: string): boolean {
    if (!isJsonMap(value)) return false;
    return value.command === wldPath && JSON.stringify(value.args || []) === JSON.stringify([...AGY_MCP_ARGS]) &&
        value.env === undefined && value.url === undefined;
}

function isRepairableRunWieldServer(value: JsonValue | undefined, wldPath: string): boolean {
    if (value === undefined) return true;
    if (!isJsonMap(value)) return false;
    if (value.command !== wldPath) return false;
    const args = JSON.stringify(value.args || []);
    return args === "[]" || args === JSON.stringify([...AGY_MCP_ARGS]);
}

function settingsHaveContradiction(settings: JsonMap): boolean {
    const permissions = settings.permissions;
    if (!isJsonMap(permissions)) return false;
    return jsonArrayContains(permissions.ask, AGY_MCP_PERMISSION) ||
        jsonArrayContains(permissions.deny, AGY_MCP_PERMISSION);
}

function settingsHavePermission(settings: JsonMap): boolean {
    const permissions = settings.permissions;
    return isJsonMap(permissions) && jsonArrayContains(permissions.allow, AGY_MCP_PERMISSION) &&
        !settingsHaveContradiction(settings);
}

async function pathIsExecutableFile(path: string): Promise<boolean> {
    const info = await lstatOrNull(path);
    return Boolean(info?.isFile && !info.isSymlink);
}

async function findPathExecutable(name: string): Promise<string | null> {
    const pathText = Deno.env.get("PATH") || "";
    for (const directory of pathText.split(":")) {
        if (!directory) continue;
        const candidate = resolve(directory, name);
        if (await pathIsExecutableFile(candidate)) return await Deno.realPath(candidate);
    }
    return null;
}

export async function resolveInstalledWldExecutable(): Promise<string> {
    if (Deno.build.standalone) {
        const execPath = await Deno.realPath(Deno.execPath());
        if (basename(execPath) === CLI_BIN && await pathIsExecutableFile(execPath)) return execPath;
    }
    const pathExecutable = await findPathExecutable(CLI_BIN);
    if (pathExecutable) return pathExecutable;
    throw new Error(`Could not find an installed ${CLI_BIN} executable for Antigravity MCP setup.`);
}

export async function inspectAgyCliMcpSetup(): Promise<SetupStatus> {
    const paths = setupPaths();
    let command = "";
    try {
        command = await resolveInstalledWldExecutable();
        const [config, settings] = await Promise.all([
            readJsonMapOrEmpty(paths.configPath),
            readJsonMapOrEmpty(paths.settingsPath),
        ]);
        const servers = config.mcpServers;
        if (servers !== undefined && !isJsonMap(servers)) {
            return {
                ok: false,
                repairable: false,
                message: "Antigravity mcpServers must be a JSON object.",
                ...paths,
                command,
            };
        }
        const server = isJsonMap(servers) ? servers[AGY_MCP_SERVER_NAME] : undefined;
        if (!isRepairableRunWieldServer(server, command)) {
            return {
                ok: false,
                repairable: false,
                message: "Antigravity already has a different runwield MCP server.",
                ...paths,
                command,
            };
        }
        if (settingsHaveContradiction(settings)) {
            return {
                ok: false,
                repairable: false,
                message: "Antigravity has an Ask or Deny rule for mcp(runwield/*).",
                ...paths,
                command,
            };
        }
        const ok = isExactRunWieldServer(server, command) && settingsHavePermission(settings);
        return {
            ok,
            repairable: true,
            message: ok ? "Antigravity MCP setup is ready." : "Antigravity MCP setup needs approval.",
            ...paths,
            command,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, repairable: false, message, ...paths, command };
    }
}

async function syncParent(path: string): Promise<void> {
    try {
        const directory = await Deno.open(dirname(path), { read: true });
        try {
            await directory.sync();
        } finally {
            directory.close();
        }
    } catch {
        // Some platforms do not permit directory fsync.
    }
}

async function writeJsonAtomically(path: string, value: JsonMap): Promise<string> {
    await Deno.mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const text = `${JSON.stringify(value, null, 2)}\n`;
    const temporary = `${path}.${crypto.randomUUID()}.tmp`;
    const file = await Deno.open(temporary, { createNew: true, write: true, mode: 0o600 });
    try {
        const bytes = new TextEncoder().encode(text);
        let offset = 0;
        while (offset < bytes.length) offset += await file.write(bytes.subarray(offset));
        await file.sync();
    } finally {
        file.close();
    }
    await Deno.rename(temporary, path);
    await syncParent(path);
    return text;
}

async function restoreIfOwnBytes(path: string, beforeText: string | null, writtenText: string): Promise<void> {
    const current = await Deno.readTextFile(path).catch(() => "");
    if (current !== writtenText) return;
    if (beforeText === null) await Deno.remove(path).catch(() => undefined);
    else await Deno.writeTextFile(path, beforeText, { mode: 0o600 });
}

function installConfig(config: JsonMap, command: string): JsonMap {
    const next: JsonMap = { ...config };
    const servers = isJsonMap(config.mcpServers) ? { ...config.mcpServers } : {};
    servers[AGY_MCP_SERVER_NAME] = { command, args: [...AGY_MCP_ARGS] };
    next.mcpServers = servers;
    return next;
}

function installSettings(settings: JsonMap): JsonMap {
    const next: JsonMap = { ...settings };
    const permissions = isJsonMap(settings.permissions) ? { ...settings.permissions } : {};
    permissions.allow = [...jsonArrayWithout(permissions.allow, AGY_MCP_PERMISSION), AGY_MCP_PERMISSION];
    next.permissions = permissions;
    return next;
}

async function readTextOrNull(path: string): Promise<string | null> {
    try {
        return await Deno.readTextFile(path);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) return null;
        throw error;
    }
}

export async function installAgyCliMcpSetup(): Promise<void> {
    const paths = setupPaths();
    await Deno.mkdir(dirname(paths.lockPath), { recursive: true, mode: 0o700 });
    const lock = await Deno.open(paths.lockPath, { create: true, read: true, write: true, mode: 0o600 });
    let writtenConfig: string | null = null;
    let beforeConfig: string | null = null;
    try {
        await lock.lock(true);
        beforeConfig = await readTextOrNull(paths.configPath);
        const status = await inspectAgyCliMcpSetup();
        if (status.ok) return;
        if (!status.repairable) throw new Error(status.message);
        const config = await readJsonMapOrEmpty(paths.configPath);
        const settings = await readJsonMapOrEmpty(paths.settingsPath);
        writtenConfig = await writeJsonAtomically(paths.configPath, installConfig(config, status.command));
        await writeJsonAtomically(paths.settingsPath, installSettings(settings));
    } catch (error) {
        if (writtenConfig !== null) await restoreIfOwnBytes(paths.configPath, beforeConfig, writtenConfig);
        throw error;
    } finally {
        lock.close();
    }
}

function setupCommand(status: SetupStatus): string {
    return `${status.command || CLI_BIN} ${AGY_MCP_ARGS.join(" ")} --setup`;
}

function setupApprovalPrompt(status: SetupStatus): string {
    return [
        "RunWield needs permission to add its Antigravity MCP server.",
        "",
        `File: ${status.configPath}`,
        `Server: ${AGY_MCP_SERVER_NAME}`,
        `Command: ${status.command} ${AGY_MCP_ARGS.join(" ")}`,
        "",
        `File: ${status.settingsPath}`,
        `Permission: ${AGY_MCP_PERMISSION}`,
        "",
        "This change persists. It stores no RunWield Session URL or token.",
    ].join("\n");
}

export async function ensureAgyCliMcpSetup(options: EnsureAgyCliMcpSetupOptions = {}): Promise<void> {
    const status = await inspectAgyCliMcpSetup();
    if (status.ok) return;
    if (!status.repairable) throw new Error(status.message);
    const hostedSession = options.hostedSession || null;
    if (!hostedSession || !supportsHostedSessionInteraction(hostedSession, RuntimeInteractionTypes.APPROVAL)) {
        throw new Error(`Antigravity MCP setup needs approval. Run ${setupCommand(status)}.`);
    }
    const request = {
        type: RuntimeInteractionTypes.APPROVAL,
        prompt: setupApprovalPrompt(status),
        options: [
            { value: "approve", label: "Approve setup", _meta: { accepted: true } },
            { value: "decline", label: "Do not change Antigravity files", _meta: { accepted: false } },
        ],
    };
    const response = await requestHostedSessionInteraction(hostedSession, request, options.signal);
    const value = typeof response.value === "string" ? response.value : String(response.value || "");
    if (response.outcome !== RuntimeInteractionOutcomes.ACCEPTED || !isApprovalAcceptedValue(request, value)) {
        throw new Error("Antigravity MCP setup was not approved.");
    }
    await installAgyCliMcpSetup();
}

export async function runAgyCliMcpSetupPrompt(): Promise<number> {
    const status = await inspectAgyCliMcpSetup();
    if (status.ok) {
        console.error("Antigravity MCP setup is already ready.");
        return 0;
    }
    if (!status.repairable) {
        console.error(status.message);
        return 1;
    }
    console.error(setupApprovalPrompt(status));
    console.error("");
    console.error("Type yes to approve this persistent change:");
    const answer = (await new Response(Deno.stdin.readable).text()).trim().toLowerCase();
    if (answer !== "yes") {
        console.error("Antigravity MCP setup was not approved.");
        return 1;
    }
    await installAgyCliMcpSetup();
    console.error("Antigravity MCP setup is ready.");
    return 0;
}
