import { assertEquals } from "@std/assert";
import { runInstallCommand } from "./index.js";

Deno.test("runInstallCommand installs source and reports resource counts", async () => {
    /** @type {string[]} */
    const logs = [];
    /** @type {unknown} */
    let ctorOptions;
    /** @type {string[]} */
    const installed = [];
    let discovered = false;

    class PackageManager {
        /** @param {unknown} options */
        constructor(options) {
            ctorOptions = options;
        }

        /** @param {string} source */
        installAndPersist(source) {
            installed.push(source);
            return Promise.resolve();
        }

        resolve() {
            return Promise.resolve({
                themes: [{ metadata: { source: "npm:theme" } }, { metadata: { source: "other" } }],
                extensions: [{ metadata: { source: "npm:theme" } }],
                skills: [{ metadata: { source: "npm:theme" } }],
                prompts: [{ metadata: { source: "other" } }],
            });
        }
    }

    const settings = { ok: true };
    await runInstallCommand(
        ["npm:theme"],
        /** @type {any} */ ({
            __testDeps: {
                PackageManager,
                cwd: () => "/repo",
                getSettingsDir: (/** @type {string} */ scope) => `/settings/${scope}`,
                getSettingsManager: () => settings,
                discoverAndRegisterThemes: () => {
                    discovered = true;
                    return Promise.resolve();
                },
                log: (/** @type {unknown} */ msg) => logs.push(String(msg)),
            },
        }),
    );

    assertEquals(ctorOptions, {
        cwd: "/repo",
        agentDir: "/settings/global",
        settingsManager: settings,
    });
    assertEquals(installed, ["npm:theme"]);
    assertEquals(discovered, true);
    assertEquals(logs, [
        "Installed npm:theme",
        "  Themes registered: 1",
        "  Non-theme resources ignored: 2 (RunWeild only loads themes)",
    ]);
});

Deno.test("runInstallCommand reports usage and install failures through injected exit", async () => {
    /** @type {string[]} */
    const errors = [];
    /** @type {number[]} */
    const exits = [];

    await runInstallCommand(
        [],
        /** @type {any} */ ({
            __testDeps: {
                error: (/** @type {unknown} */ msg) => errors.push(String(msg)),
                exit: (/** @type {number} */ code) => {
                    exits.push(code);
                    return undefined;
                },
            },
        }),
    );

    assertEquals(errors, [
        "Usage: wld install <source>",
        "Sources: npm:<spec>, git:<url>, local:<path>",
    ]);
    assertEquals(exits, [1]);

    class FailingPackageManager {
        installAndPersist() {
            return Promise.reject(new Error("nope"));
        }
    }

    await runInstallCommand(
        ["npm:bad"],
        /** @type {any} */ ({
            __testDeps: {
                PackageManager: FailingPackageManager,
                cwd: () => "/repo",
                getSettingsDir: () => "/settings",
                getSettingsManager: () => ({}),
                error: (/** @type {unknown} */ msg) => errors.push(String(msg)),
                exit: (/** @type {number} */ code) => {
                    exits.push(code);
                    return undefined;
                },
            },
        }),
    );

    assertEquals(errors.at(-1), "Installation failed: nope");
    assertEquals(exits, [1, 1]);
});
