import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { disablePackageExtensions, runInstallCommand } from "./index.js";

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
                prompts: [{ metadata: { source: "npm:theme" } }, { metadata: { source: "other" } }],
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
        "  Prompt templates available: 1",
        "  Code extensions ignored: 1 (missing pi.wld compatibility marker)",
        "  Skills ignored: 1 (RunWield does not load Pi package skills)",
        "  Install skills separately with: npx skills add npm:theme",
        "  Use -a/--agent to choose the target agent when needed.",
    ]);
});

Deno.test("runInstallCommand enables compatible extensions after consent", async () => {
    const tempDir = await Deno.makeTempDir({ prefix: "runwield-install-extension-yes-" });
    const extensionPath = join(tempDir, "index.js");
    /** @type {string[]} */
    const logs = [];
    /** @type {string[]} */
    const installed = [];
    const settings = {
        /** @type {any[]} */
        packages: ["npm:ext"],
        getGlobalSettings() {
            return { packages: this.packages };
        },
        /** @param {any[]} packages */
        setPackages(packages) {
            this.packages = packages;
        },
    };

    try {
        await Deno.writeTextFile(
            join(tempDir, "package.json"),
            JSON.stringify({
                pi: {
                    extensions: ["./index.js"],
                    wld: {
                        compatible: true,
                        extensionApi: 1,
                        kind: "code-extension",
                    },
                },
            }),
        );
        await Deno.writeTextFile(extensionPath, "export default () => ({});\n");

        class PackageManager {
            /** @param {string} source */
            installAndPersist(source) {
                installed.push(source);
                return Promise.resolve();
            }

            resolve() {
                return Promise.resolve({
                    themes: [],
                    prompts: [],
                    skills: [],
                    extensions: [{
                        path: extensionPath,
                        enabled: true,
                        metadata: { source: "npm:ext", scope: "user", origin: "package", baseDir: tempDir },
                    }],
                });
            }
        }

        await runInstallCommand(
            ["npm:ext"],
            /** @type {any} */ ({
                __testDeps: {
                    PackageManager,
                    cwd: () => "/repo",
                    getSettingsDir: () => "/settings",
                    getSettingsManager: () => settings,
                    discoverAndRegisterThemes: () => Promise.resolve(),
                    confirmWldExtensionInstall: () => true,
                    log: (/** @type {unknown} */ msg) => logs.push(String(msg)),
                },
            }),
        );

        assertEquals(installed, ["npm:ext"]);
        assertEquals(settings.packages, ["npm:ext"]);
        assertEquals(logs, [
            "Installed npm:ext",
            "  Themes registered: 0",
            "  Prompt templates available: 0",
            "  WLD-compatible code extensions enabled: 1",
        ]);
    } finally {
        await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
});

Deno.test("runInstallCommand skips compatible extensions when consent is declined", async () => {
    const tempDir = await Deno.makeTempDir({ prefix: "runwield-install-extension-no-" });
    const extensionPath = join(tempDir, "index.js");
    /** @type {string[]} */
    const logs = [];
    const settings = {
        /** @type {any[]} */
        packages: ["npm:ext"],
        getGlobalSettings() {
            return { packages: this.packages };
        },
        /** @param {any[]} packages */
        setPackages(packages) {
            this.packages = packages;
        },
    };

    try {
        await Deno.writeTextFile(
            join(tempDir, "package.json"),
            JSON.stringify({
                pi: {
                    extensions: ["./index.js"],
                    wld: {
                        compatible: true,
                        extensionApi: 1,
                        kind: "code-extension",
                    },
                },
            }),
        );
        await Deno.writeTextFile(extensionPath, "export default () => ({});\n");

        class PackageManager {
            installAndPersist() {
                return Promise.resolve();
            }

            resolve() {
                return Promise.resolve({
                    themes: [],
                    prompts: [],
                    skills: [],
                    extensions: [{
                        path: extensionPath,
                        enabled: true,
                        metadata: { source: "npm:ext", scope: "user", origin: "package", baseDir: tempDir },
                    }],
                });
            }
        }

        await runInstallCommand(
            ["npm:ext"],
            /** @type {any} */ ({
                __testDeps: {
                    PackageManager,
                    cwd: () => "/repo",
                    getSettingsDir: () => "/settings",
                    getSettingsManager: () => settings,
                    discoverAndRegisterThemes: () => Promise.resolve(),
                    confirmWldExtensionInstall: () => false,
                    log: (/** @type {unknown} */ msg) => logs.push(String(msg)),
                },
            }),
        );

        assertEquals(settings.packages, [{ source: "npm:ext", extensions: [] }]);
        assertEquals(logs, [
            "Installed npm:ext",
            "  Themes registered: 0",
            "  Prompt templates available: 0",
            "  WLD-compatible code extensions skipped: 1",
        ]);
    } finally {
        await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
});

Deno.test("disablePackageExtensions preserves existing package filters", () => {
    const settings = {
        /** @type {any[]} */
        packages: [{ source: "npm:ext", prompts: ["prompts/*.md"], themes: ["themes/*.json"] }],
        getGlobalSettings() {
            return { packages: this.packages };
        },
        /** @param {any[]} packages */
        setPackages(packages) {
            this.packages = packages;
        },
    };

    assertEquals(disablePackageExtensions(/** @type {any} */ (settings), "npm:ext"), true);
    assertEquals(settings.packages, [{
        source: "npm:ext",
        prompts: ["prompts/*.md"],
        themes: ["themes/*.json"],
        extensions: [],
    }]);
    assertEquals(disablePackageExtensions(/** @type {any} */ (settings), "npm:missing"), false);
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
