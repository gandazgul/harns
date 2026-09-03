import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { RunWieldModel } from "../../../models/model-registry.ts";
import type { HostedSession } from "../../hosted-session.js";
import { emitHostedSessionRuntimeEvent, RuntimeEventTypes } from "../../session-runtime-events.js";
import { getRootSessionBranchEntries } from "../../root-session.js";
import { cleanupAgyCustomAgent, materializeAgyCustomAgent } from "./custom-agent.ts";
import type { AgyCustomAgentOwnership } from "./custom-agent.ts";
import { prepareAgyCliAgentsCommand, prepareAgyCliStreamCommand } from "./command.ts";
import { DenoAgyCliProcessPort } from "./process.ts";
import type { AgyCliProcessResult } from "./process.ts";
import { parseAgyCliStream } from "./stream-parser.ts";
import type { AgyCliUsage } from "./stream-parser.ts";

interface TranscriptTextBlock {
    type?: string;
    text?: string;
}

interface TranscriptMessage {
    role?: string;
    content?: TranscriptTextBlock[] | string;
}

interface TranscriptEntry {
    type?: string;
    message?: TranscriptMessage;
    customType?: string;
    data?: { expandedText?: string; compactInvocation?: string };
}

interface ConversationMessage {
    role: "user" | "assistant";
    text: string;
}

type SessionAppendMessage = Parameters<SessionManager["appendMessage"]>[0];

export interface AgyCliExecutionSessionOptions {
    cwd: string;
    agentName: string;
    agentDisplayName: string;
    finalSystemPrompt: string;
    model: RunWieldModel;
    sessionManager: SessionManager;
    hostedSession?: HostedSession;
    thinkingLevel?: string;
    persistModelChange?: boolean;
}

export interface AgyCliRunOptions {
    userRequest: string;
    images?: { base64: string; mimeType: string }[];
    signal?: AbortSignal;
    requestId?: string;
    attemptId?: string;
}

export class AgyCliExecutionSession {
    readonly kind = "agy-cli";
    readonly id: string;
    readonly model: RunWieldModel;
    readonly agentName: string;
    readonly agentDisplayName: string;
    readonly sessionManager: SessionManager;
    readonly finalSystemPrompt: string;
    private readonly cwd: string;
    private readonly hostedSession?: HostedSession;
    private readonly ownership: AgyCustomAgentOwnership;
    private readonly thinkingLevel?: string;
    private readonly persistModelChange: boolean;
    private messages: AgentMessage[] = [];
    private activeProcess: AgyCliProcessResult | null = null;
    private turnAbortController: AbortController | null = null;
    isStreaming = false;

    private constructor(options: AgyCliExecutionSessionOptions, ownership: AgyCustomAgentOwnership) {
        this.id = `agy-cli:${crypto.randomUUID()}`;
        this.cwd = options.cwd;
        this.agentName = options.agentName;
        this.agentDisplayName = options.agentDisplayName;
        this.finalSystemPrompt = options.finalSystemPrompt;
        this.model = options.model;
        this.sessionManager = options.sessionManager;
        this.hostedSession = options.hostedSession;
        this.thinkingLevel = options.thinkingLevel;
        this.persistModelChange = options.persistModelChange !== false;
        this.ownership = ownership;
        this.messages = this.readMessages();
    }

    static async create(options: AgyCliExecutionSessionOptions): Promise<AgyCliExecutionSession> {
        const selector = makeTemporaryAgentSelector(options.agentName);
        const definition = formatAgyCustomAgentDefinition(options.finalSystemPrompt, options.agentDisplayName);
        let ownership: AgyCustomAgentOwnership | null = null;
        try {
            ownership = await materializeAgyCustomAgent(selector, definition);
            await verifyAgyCustomAgentListed(selector, options.cwd);
            return new AgyCliExecutionSession(options, ownership);
        } catch (error) {
            if (ownership) await cleanupAgyCustomAgent(ownership).catch(() => undefined);
            throw new Error(`Could not prepare Antigravity custom agent for ${options.agentDisplayName}.`, {
                cause: error,
            });
        }
    }

    getMessages(): AgentMessage[] {
        return [...this.messages];
    }

    async dispose(): Promise<void> {
        this.abort();
        await cleanupAgyCustomAgent(this.ownership);
    }

    abort(): void {
        this.turnAbortController?.abort();
        this.activeProcess?.kill();
    }

    clearQueue(): void {}

    async runTurn(options: AgyCliRunOptions): Promise<AgentMessage[]> {
        if (options.images && options.images.length > 0) {
            throw new Error("Agy CLI execution backend does not support image attachments in this slice");
        }
        const effort = thinkingLevelToEffort(this.thinkingLevel);
        const conversation = this.readConversation();
        conversation.push({ role: "user", text: options.userRequest });
        const serializedConversation = serializeConversation(conversation);
        if (serializedConversation.includes(this.finalSystemPrompt)) {
            throw new Error("Agy user text cannot contain the Agent Definition");
        }

        this.turnAbortController = new AbortController();
        const combinedSignal = options.signal
            ? AbortSignal.any([options.signal, this.turnAbortController.signal])
            : this.turnAbortController.signal;
        this.isStreaming = true;
        try {
            const command = prepareAgyCliStreamCommand({
                agentName: this.ownership.name,
                model: this.model.id,
                userRequest: serializedConversation,
                effort,
            });
            const processPort = new DenoAgyCliProcessPort();
            const process = processPort.run(command, this.cwd, combinedSignal);
            this.activeProcess = process;

            const userMessage = makeUserMessage(options.userRequest);
            this.sessionManager.appendMessage(userMessage);
            this.messages.push(userMessage as AgentMessage);
            appendExecutionBackendEntry(this.sessionManager, this.model, {
                requestId: options.requestId,
                attemptId: options.attemptId,
            });

            const messageId = `agy-cli-assistant:${crypto.randomUUID()}`;
            const parsed = await parseAgyCliStream(process.stdout, {
                onDelta: (delta) => {
                    emitHostedSessionRuntimeEvent(this.hostedSession, {
                        type: RuntimeEventTypes.ASSISTANT_TEXT_DELTA,
                        messageId,
                        delta: delta.text,
                        agentName: this.agentDisplayName,
                        messageKind: "assistant",
                    });
                },
            });
            const status = await process.completed;
            if (combinedSignal.aborted) {
                process.kill();
                throw new Error("Agy CLI turn canceled.");
            }
            if (!status.success) {
                throw new Error("Agy CLI exited before completing the turn.");
            }
            if (parsed.metadata.model && parsed.metadata.model !== this.model.id) {
                throw new Error("Agy CLI selected a different model than RunWield requested.");
            }

            if (this.persistModelChange) this.sessionManager.appendModelChange(this.model.provider, this.model.id);
            const assistantMessage = makeAssistantMessage(parsed.text, this.model, parsed.metadata.usage);
            this.sessionManager.appendMessage(assistantMessage);
            appendExecutionBackendEntry(this.sessionManager, this.model, {
                requestId: options.requestId,
                attemptId: options.attemptId,
                externalConversationId: parsed.metadata.sessionId,
            });
            this.messages.push(assistantMessage as AgentMessage);
            emitHostedSessionRuntimeEvent(this.hostedSession, {
                type: RuntimeEventTypes.USAGE,
                usage: toRuntimeUsage(parsed.metadata.usage),
            });
            return this.getMessages();
        } catch (error) {
            this.activeProcess?.kill();
            throw error;
        } finally {
            this.activeProcess = null;
            this.isStreaming = false;
            this.turnAbortController = null;
        }
    }

    private readMessages(): AgentMessage[] {
        return this.readConversation().map((message) => {
            return message.role === "user"
                ? makeUserMessage(message.text) as AgentMessage
                : makeAssistantMessage(message.text, this.model, zeroUsage()) as AgentMessage;
        });
    }

    private readConversation(): ConversationMessage[] {
        const messages: ConversationMessage[] = [];
        let skipNextCompactInvocation = "";
        for (const entry of getRootSessionBranchEntries(this.sessionManager)) {
            const transcriptEntry = entry as TranscriptEntry;
            const expanded = readNamedInvocationExpandedText(transcriptEntry);
            if (expanded) {
                messages.push({ role: "user", text: expanded });
                skipNextCompactInvocation = transcriptEntry.data?.compactInvocation || "";
                continue;
            }
            for (const message of normalizeTranscriptEntry(transcriptEntry)) {
                if (
                    skipNextCompactInvocation && message.role === "user" && message.text === skipNextCompactInvocation
                ) {
                    skipNextCompactInvocation = "";
                    continue;
                }
                skipNextCompactInvocation = "";
                messages.push(message);
            }
        }
        return messages;
    }
}

function formatAgyCustomAgentDefinition(systemPrompt: string, displayName: string): string {
    return [
        "---",
        `description: Temporary RunWield ${displayName} execution agent`,
        "---",
        "",
        systemPrompt.trim(),
        "",
    ].join("\n");
}

function makeTemporaryAgentSelector(agentName: string): string {
    const sanitized = agentName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "agent";
    return `runwield-${sanitized}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function thinkingLevelToEffort(thinkingLevel: string | undefined): "low" | "medium" | "high" | undefined {
    if (!thinkingLevel || thinkingLevel === "off") return undefined;
    if (thinkingLevel === "low" || thinkingLevel === "medium" || thinkingLevel === "high") return thinkingLevel;
    throw new Error(`Agy CLI does not support thinkingLevel "${thinkingLevel}".`);
}

async function verifyAgyCustomAgentListed(agentName: string, cwd: string): Promise<void> {
    const processPort = new DenoAgyCliProcessPort();
    const result = processPort.run(prepareAgyCliAgentsCommand(), cwd);
    const stdoutText = await new Response(result.stdout).text();
    const status = await result.completed;
    if (!status.success) throw new Error("agy /agents failed");
    let parsed: JsonValue;
    try {
        parsed = JSON.parse(stdoutText) as JsonValue;
    } catch {
        throw new Error("agy /agents did not return JSON");
    }
    if (!agentListContainsExactName(parsed, agentName)) {
        throw new Error("agy /agents did not list the expected RunWield custom agent");
    }
}

type JsonScalar = string | number | boolean | null;
type JsonArray = JsonValue[];
interface JsonRecord {
    [key: string]: JsonValue;
}
type JsonValue = JsonScalar | JsonArray | JsonRecord;

function isJsonRecord(value: JsonValue | undefined): value is JsonRecord {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readAgentList(value: JsonValue): JsonArray | null {
    if (Array.isArray(value)) return value;
    if (isJsonRecord(value) && Array.isArray(value.agents)) return value.agents;
    return null;
}

function agentEntryMatchesName(value: JsonValue, expected: string): boolean {
    if (typeof value === "string") return value === expected;
    if (!isJsonRecord(value)) return false;
    return value.name === expected;
}

function agentListContainsExactName(value: JsonValue, expected: string): boolean {
    const agents = readAgentList(value);
    return Boolean(agents?.some((agent) => agentEntryMatchesName(agent, expected)));
}

function readNamedInvocationExpandedText(entry: TranscriptEntry): string {
    return entry.type === "custom" && entry.customType === "runwield.named_invocation_expanded" &&
            typeof entry.data?.expandedText === "string"
        ? entry.data.expandedText
        : "";
}

function normalizeTranscriptEntry(entry: TranscriptEntry): ConversationMessage[] {
    const message = entry.message;
    if (entry.type !== "message" || !message) return [];
    if (message.role !== "user" && message.role !== "assistant") return [];
    const text = extractText(message.content);
    return text ? [{ role: message.role, text }] : [];
}

function extractText(content: TranscriptTextBlock[] | string | undefined): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content.map((block) => block.type === "text" && typeof block.text === "string" ? block.text : "").join("");
}

function makeUserMessage(text: string): SessionAppendMessage {
    return {
        role: "user",
        timestamp: Date.now(),
        content: [{ type: "text", text }],
    };
}

function makeAssistantMessage(text: string, model: RunWieldModel, usage: AgyCliUsage): SessionAppendMessage {
    return {
        role: "assistant",
        timestamp: Date.now(),
        content: [{ type: "text", text }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: toPiUsage(usage),
        stopReason: "stop",
    };
}

function zeroUsage(): AgyCliUsage {
    return { inputTokens: 0, outputTokens: 0 };
}

function toPiUsage(usage: AgyCliUsage) {
    return {
        input: usage.inputTokens,
        output: usage.outputTokens,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: usage.inputTokens + usage.outputTokens,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    };
}

function toRuntimeUsage(usage: AgyCliUsage) {
    return {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 0,
    };
}

function serializeConversation(messages: ConversationMessage[]): string {
    return messages.map((message) => `${message.role.toUpperCase()}: ${message.text}`).join("\n\n");
}

function appendExecutionBackendEntry(
    sessionManager: SessionManager,
    model: RunWieldModel,
    options: { requestId?: string; attemptId?: string; externalConversationId?: string },
): void {
    sessionManager.appendCustomEntry("runwield.execution_backend", {
        version: 1,
        backend: "agy-cli",
        provider: model.provider,
        model: model.id,
        outputFormat: "stream-json",
        ...(options.requestId ? { requestId: options.requestId } : {}),
        ...(options.attemptId ? { attemptId: options.attemptId } : {}),
        ...(options.externalConversationId ? { externalConversationId: options.externalConversationId } : {}),
    });
}
