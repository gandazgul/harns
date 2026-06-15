/**
 * @module cmd/install
 * Harns install command wrapping Pi's PackageManager.
 */

import { DefaultPackageManager } from "@earendil-works/pi-coding-agent";
import { getSettingsDir, getSettingsManager } from "../../shared/settings.js";
import { discoverAndRegisterThemes } from "../../shared/ui/theme.js";

/**
 * @param {string[]} argv
 * @param {import('../registry.js').CommandContext} _options
 */
export async function runInstallCommand(argv, _options = {}) {
    const deps = /** @type {{
        PackageManager?: typeof DefaultPackageManager,
        getSettingsManager?: typeof getSettingsManager,
        getSettingsDir?: typeof getSettingsDir,
        discoverAndRegisterThemes?: typeof discoverAndRegisterThemes,
        cwd?: () => string,
        log?: typeof console.log,
        error?: typeof console.error,
        exit?: typeof Deno.exit,
    }} */
        (_options.__testDeps || {});
    const error = deps.error || console.error;
    const exit = deps.exit || Deno.exit;

    if (argv.length === 0) {
        error("Usage: hns install <source>");
        error("Sources: npm:<spec>, git:<url>, local:<path>");
        exit(1);
        return;
    }

    const source = argv[0];
    try {
        const SettingsPackageManager = deps.PackageManager || DefaultPackageManager;
        const settings = (deps.getSettingsManager || getSettingsManager)();
        const packageManager = new SettingsPackageManager({
            cwd: (deps.cwd || Deno.cwd)(),
            agentDir: (deps.getSettingsDir || getSettingsDir)("global"),
            settingsManager: settings,
        });

        await packageManager.installAndPersist(source);

        // Inspect what this specific package contributed. Themes are
        // registered; everything else is ignored.
        const resolved = await packageManager.resolve();
        const fromSource = (/** @type {{ metadata: { source: string } }} */ r) => r.metadata.source === source;
        const themeCount = resolved.themes.filter(fromSource).length;
        const ignoredCount = resolved.extensions.filter(fromSource).length +
            resolved.skills.filter(fromSource).length +
            resolved.prompts.filter(fromSource).length;

        await (deps.discoverAndRegisterThemes || discoverAndRegisterThemes)();

        const log = deps.log || console.log;
        log(`Installed ${source}`);
        log(`  Themes registered: ${themeCount}`);
        if (ignoredCount > 0) {
            log(`  Non-theme resources ignored: ${ignoredCount} (Harns only loads themes)`);
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        error(`Installation failed: ${msg}`);
        exit(1);
    }
}
