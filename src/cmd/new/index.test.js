import { assertEquals } from "@std/assert";
import { runNewCommand } from "./index.js";

Deno.test("runNewCommand reports when used outside interactive mode", async () => {
    /** @type {string[]} */
    const errors = [];
    const origError = console.error;
    console.error = (msg = "") => errors.push(String(msg));
    try {
        await runNewCommand([], {});
    } finally {
        console.error = origError;
    }

    assertEquals(errors, ["The /new command is only available inside an interactive session."]);
});

Deno.test("runNewCommand creates and installs a fresh root session", async () => {
    /** @type {string[]} */
    const messages = [];
    /** @type {string[]} */
    const infos = [];
    let cleared = false;
    let installed = false;
    /** @type {unknown[]} */
    const createArgs = [];

    const manager = {
        appendSessionInfo: (/** @type {string} */ info) => infos.push(info),
        getSessionId: () => "session-123",
    };

    await runNewCommand(
        ["build", "coverage"],
        /** @type {any} */ ({
            uiAPI: {
                clearMessages: () => {
                    cleared = true;
                },
                appendSystemMessage: (/** @type {string} */ msg) => messages.push(msg),
            },
            __testDeps: {
                createRootSessionManager: (
                    /** @type {string} */ mode,
                    /** @type {string} */ cwd,
                ) => {
                    createArgs.push(mode, cwd);
                    return Promise.resolve(manager);
                },
                setRootSessionManager: (/** @type {unknown} */ value) => {
                    installed = value === manager;
                },
            },
        }),
    );

    assertEquals(createArgs, ["new", Deno.cwd()]);
    assertEquals(infos, ["build coverage"]);
    assertEquals(installed, true);
    assertEquals(cleared, true);
    assertEquals(messages, ["Started new session: session-123"]);
});
