import { assertEquals } from "@std/assert";
import { runReloadCommand } from "./index.js";
import { setRootAgentSession } from "../../shared/session/session-state.js";

Deno.test("runReloadCommand reports no active root session", async () => {
    /** @type {string[]} */
    const messages = [];
    setRootAgentSession(null);

    await runReloadCommand([], {
        uiAPI: /** @type {any} */ ({
            appendSystemMessage: (/** @type {string} */ message) => messages.push(message),
        }),
    });

    assertEquals(messages, ["Reload skipped (no active root session found)."]);
});
