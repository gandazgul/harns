import { assertEquals } from "@std/assert";
import { runSessionCommand } from "./index.js";
import { setRootSessionManager } from "../../shared/session/session-state.js";
import { initHarnsTheme } from "../../shared/ui/theme.js";

initHarnsTheme();

/**
 * @returns {{ uiAPI: any, messages: string[] }}
 */
function makeUi() {
    /** @type {string[]} */
    const messages = [];
    return {
        messages,
        uiAPI: {
            appendSystemMessage: (/** @type {string} */ message) => messages.push(message),
        },
    };
}

Deno.test("runSessionCommand reports no active session inside interactive mode", async () => {
    setRootSessionManager(null);
    const { uiAPI, messages } = makeUi();

    await runSessionCommand([], { uiAPI });

    assertEquals(messages, ["Error: No active session."]);
});

Deno.test("runSessionCommand summarizes messages, tool use, compactions, and token usage", async () => {
    const { uiAPI, messages } = makeUi();
    setRootSessionManager(
        /** @type {any} */ ({
            getSessionName: () => "Deep Work",
            getSessionFile: () => "/tmp/session.jsonl",
            getSessionId: () => "session-123",
            getEntries: () => [
                { type: "compaction" },
                { type: "message", message: { role: "user", content: "hello" } },
                {
                    type: "message",
                    message: {
                        role: "user",
                        content: [{ type: "tool_result", text: "ok" }],
                    },
                },
                {
                    type: "message",
                    message: {
                        role: "assistant",
                        content: [{ type: "tool_use", name: "bash" }],
                        usage: {
                            inputTokens: 1000,
                            outputTokens: 250,
                            cacheReadTokens: 500,
                            cacheWriteTokens: 25,
                        },
                    },
                },
            ],
        }),
    );

    try {
        await runSessionCommand([], { uiAPI });
    } finally {
        setRootSessionManager(null);
    }

    const plain = messages.join("\n");
    assertEquals(plain.includes("Session compacted 1 time"), true);
    assertEquals(plain.includes("Deep Work"), true);
    assertEquals(plain.includes("/tmp/session.jsonl"), true);
    assertEquals(plain.includes("session-123"), true);
    assertEquals(plain.includes("User:"), true);
    assertEquals(plain.includes("2"), true);
    assertEquals(plain.includes("Assistant:"), true);
    assertEquals(plain.includes("Tool Calls:"), true);
    assertEquals(plain.includes("Tool Results:"), true);
    assertEquals(plain.includes("1,000"), true);
    assertEquals(plain.includes("500"), true);
    assertEquals(plain.includes("1,775"), true);
});
