import { assert, assertEquals, assertThrows } from "@std/assert";
import { buildPlansUiUrl, isLoopbackHost, parsePlansUiArgs, runPlansUiCommand } from "./ui.js";

Deno.test("parsePlansUiArgs defaults to loopback random port", () => {
    assertEquals(parsePlansUiArgs([]), {
        host: "127.0.0.1",
        port: 0,
        noOpen: false,
        help: false,
        explicitBind: false,
    });
});

Deno.test("parsePlansUiArgs accepts bind, host alias, port, no-open, and help", () => {
    assertEquals(parsePlansUiArgs(["--host", "localhost", "--port", "8765", "--no-open"]).host, "localhost");
    assertEquals(parsePlansUiArgs(["--bind=0.0.0.0", "--port=0"]).explicitBind, true);
    assertEquals(parsePlansUiArgs(["--help"]).help, true);
});

Deno.test("parsePlansUiArgs rejects conflicting host bind and invalid ports", () => {
    assertThrows(() => parsePlansUiArgs(["--bind", "127.0.0.1", "--host", "localhost"]));
    assertThrows(() => parsePlansUiArgs(["--port", "70000"]));
});

Deno.test("isLoopbackHost detects loopback hosts", () => {
    assertEquals(isLoopbackHost("127.0.0.1"), true);
    assertEquals(isLoopbackHost("localhost"), true);
    assertEquals(isLoopbackHost("0.0.0.0"), false);
});

Deno.test("buildPlansUiUrl includes token and loopback URL for wildcard bind", () => {
    const url = buildPlansUiUrl({ host: "0.0.0.0", port: 4321, token: "secret" });
    assertEquals(url, "http://127.0.0.1:4321/?token=secret");
});

Deno.test("buildPlansUiUrl brackets IPv6 loopback hosts", () => {
    const url = buildPlansUiUrl({ host: "::1", port: 4321, token: "secret" });
    assertEquals(url, "http://[::1]:4321/?token=secret");
});

Deno.test("runPlansUiCommand starts server with injected dependencies and suppresses open", async () => {
    /** @type {string[]} */
    const logs = [];
    const originalLog = console.log;
    console.log = (msg = "") => logs.push(String(msg));
    try {
        let launched = false;
        await runPlansUiCommand(["--no-open"], {
            __testDeps: {
                generateWorkspaceToken: () => "tok",
                installShutdownHandler: () => () => {},
                startWorkspaceServer: (/** @type {any} */ options) => {
                    launched = options.host === "127.0.0.1" && options.port === 0 && options.token === "tok";
                    return { addr: { port: 3456 } };
                },
                openBrowser: () => {
                    throw new Error("should not open");
                },
            },
        });
        assertEquals(launched, true);
        assert(logs.some((line) => line.includes("http://127.0.0.1:3456/?token=tok")));
    } finally {
        console.log = originalLog;
    }
});

Deno.test("runPlansUiCommand warns for explicit non-loopback binds", async () => {
    /** @type {string[]} */
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (msg = "") => warnings.push(String(msg));
    try {
        await runPlansUiCommand(["--bind", "0.0.0.0", "--no-open"], {
            __testDeps: {
                generateWorkspaceToken: () => "tok",
                installShutdownHandler: () => () => {},
                startWorkspaceServer: () => ({ addr: { port: 3456 } }),
            },
        });
        assert(warnings.some((line) => line.includes("Warning") && line.includes("0.0.0.0")));
    } finally {
        console.warn = originalWarn;
    }
});
