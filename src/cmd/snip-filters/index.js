/**
 * @module cmd/snip-filters
 * Install or clean up RunWeild-managed Snip filters.
 */

import {
    cleanupRunWeildSnipFiltersForUser,
    getRunWeildSnipFilterInstallStatus,
    installRunWeildSnipFiltersForUser,
} from "../../shared/snip-filters.js";

/**
 * @param {string[]} paths
 * @returns {string}
 */
function formatPathList(paths) {
    return paths.length === 0 ? "none" : paths.map((path) => `- ${path}`).join("\n");
}

/**
 * @param {Array<{ path: string, reason: string }>} skipped
 * @returns {string}
 */
function formatSkipped(skipped) {
    return skipped.length === 0 ? "none" : skipped.map((item) => `- ${item.path} (${item.reason})`).join("\n");
}

/**
 * @param {string[]} argv
 * @param {import('../registry.js').CommandContext} _options
 */
export async function runSnipFiltersCommand(argv, _options = {}) {
    const deps = /** @type {{
        installRunWeildSnipFiltersForUser?: typeof installRunWeildSnipFiltersForUser,
        cleanupRunWeildSnipFiltersForUser?: typeof cleanupRunWeildSnipFiltersForUser,
        getRunWeildSnipFilterInstallStatus?: typeof getRunWeildSnipFilterInstallStatus,
        log?: typeof console.log,
        error?: typeof console.error,
        exit?: typeof Deno.exit,
    }} */
        (_options.__testDeps || {});
    const log = deps.log || console.log;
    const error = deps.error || console.error;
    const exit = deps.exit || Deno.exit;
    const action = argv[0] || "status";

    try {
        if (action === "install") {
            const result = await (deps.installRunWeildSnipFiltersForUser || installRunWeildSnipFiltersForUser)();
            log(`Installed RunWeild Snip filters into ${result.filtersDir}`);
            log(`Updated:\n${formatPathList(result.installed)}`);
            if (result.skipped.length > 0) {
                log(`Skipped:\n${formatSkipped(result.skipped)}`);
            }
            return;
        }

        if (action === "cleanup" || action === "remove" || action === "uninstall") {
            const result = await (deps.cleanupRunWeildSnipFiltersForUser || cleanupRunWeildSnipFiltersForUser)();
            log(`Cleaned up RunWeild Snip filters from ${result.filtersDir}`);
            log(`Removed:\n${formatPathList(result.removed)}`);
            if (result.skipped.length > 0) {
                log(`Skipped:\n${formatSkipped(result.skipped)}`);
            }
            return;
        }

        if (action === "status") {
            const result = await (deps.getRunWeildSnipFilterInstallStatus || getRunWeildSnipFilterInstallStatus)();
            log(`RunWeild Snip filter status in ${result.filtersDir}`);
            log(`Installed:\n${formatPathList(result.installed)}`);
            log(`Missing:\n${formatPathList(result.missing)}`);
            if (result.conflicts.length > 0) {
                log(`Conflicts:\n${formatPathList(result.conflicts)}`);
            }
            return;
        }

        error("Usage: wld snip-filters [install|cleanup|status]");
        exit(1);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        error(`Snip filter command failed: ${msg}`);
        exit(1);
    }
}
