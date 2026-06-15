import { assertEquals } from "@std/assert";
import { runRemoveCommand } from "./index.js";

Deno.test("runRemoveCommand removes a source and resets missing active theme", async () => {
    /** @type {string[]} */
    const logs = [];
    /** @type {string[]} */
    const removed = [];
    /** @type {string[]} */
    const persistedThemes = [];
    /** @type {string[]} */
    const appliedThemes = [];
    let discovered = false;

    const settings = {
        getTheme: () => "removed-theme",
        setTheme: (/** @type {string} */ name) => persistedThemes.push(name),
    };

    class PackageManager {
        /** @param {unknown} _options */
        constructor(_options) {}

        /** @param {string} source */
        removeAndPersist(source) {
            removed.push(source);
            return Promise.resolve(true);
        }
    }

    await runRemoveCommand(
        ["npm:theme"],
        /** @type {any} */ ({
            __testDeps: {
                PackageManager,
                cwd: () => "/repo",
                getSettingsDir: () => "/settings",
                getSettingsManager: () => settings,
                discoverAndRegisterThemes: () => {
                    discovered = true;
                    return Promise.resolve();
                },
                getAvailableThemes: () => ["catppuccin-mocha"],
                setTheme: (/** @type {string} */ name) => appliedThemes.push(name),
                log: (/** @type {unknown} */ msg) => logs.push(String(msg)),
            },
        }),
    );

    assertEquals(removed, ["npm:theme"]);
    assertEquals(discovered, true);
    assertEquals(persistedThemes, ["catppuccin-mocha"]);
    assertEquals(appliedThemes, ["catppuccin-mocha"]);
    assertEquals(logs, [
        'Active theme "removed-theme" was provided by the removed package — reset to catppuccin-mocha.',
        "Successfully removed npm:theme",
    ]);
});

Deno.test("runRemoveCommand reports not-installed, usage, and failures", async () => {
    /** @type {string[]} */
    const logs = [];
    /** @type {string[]} */
    const errors = [];
    /** @type {number[]} */
    const exits = [];

    class MissingPackageManager {
        removeAndPersist() {
            return Promise.resolve(false);
        }
    }

    await runRemoveCommand(
        ["npm:missing"],
        /** @type {any} */ ({
            __testDeps: {
                PackageManager: MissingPackageManager,
                cwd: () => "/repo",
                getSettingsDir: () => "/settings",
                getSettingsManager: () => ({}),
                log: (/** @type {unknown} */ msg) => logs.push(String(msg)),
            },
        }),
    );

    await runRemoveCommand(
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

    class FailingPackageManager {
        removeAndPersist() {
            return Promise.reject("bad remove");
        }
    }

    await runRemoveCommand(
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

    assertEquals(logs, ['Package "npm:missing" is not currently installed — nothing to remove.']);
    assertEquals(errors, ["Usage: hns remove <source>", "Removal failed: bad remove"]);
    assertEquals(exits, [1, 1]);
});
