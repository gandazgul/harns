/**
 * @module extensions/rtk
 * Optional RTK command rewrite extension for Harns agent invocations.
 */

/**
 * Default list of binary names whose commands bypass RTK rewriting.
 * Can be overridden via the factory options.
 * @type {string[]}
 */
const DEFAULT_EXCLUDED_BINARIES = ["git"];

/**
 * Check whether a command contains one of the excluded binary names as a word.
 * Uses \b word boundaries so "git" inside "legit" or "github" does not match,
 * but "cd repo && git status", "GIT_TRACE=1 git commit", etc. do match.
 *
 * @param {string} command - The trimmed command string
 * @param {string[]} excluded - List of excluded binary names
 * @returns {boolean}
 */
function isExcludedCommand(command, excluded) {
    return excluded.some((binary) => {
        // Escape regex metacharacters in the binary name (e.g. dots, plus)
        const escaped = binary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`).test(command);
    });
}

/**
 * Register RTK command rewriting for agent bash tool calls.
 *
 * @param {import('@earendil-works/pi-coding-agent').ExtensionAPI} pi
 * @param {{ excludedBinaries?: string[] }} [options]
 */
export default function rtkExtension(pi, options = {}) {
    const excludedBinaries = options.excludedBinaries ?? DEFAULT_EXCLUDED_BINARIES;
    let projectCwd = Deno.cwd();

    pi.on("session_start", (_event, ctx) => {
        projectCwd = ctx.cwd;
    });

    pi.on("tool_call", async (event, _ctx) => {
        if (event.toolName !== "bash") return;
        const input = event.input;
        if (!input || typeof input.command !== "string") return;

        const originalCommand = input.command.trim();
        if (!originalCommand || originalCommand.startsWith("rtk ")) return;

        // Bypass RTK for excluded binaries (e.g. git)
        if (isExcludedCommand(originalCommand, excludedBinaries)) return;

        try {
            const result = await pi.exec("rtk", ["rewrite", originalCommand], { cwd: projectCwd });
            if (result.code !== 0) return;

            const rewrittenCommand = (result.stdout || result.stderr || "").trim();
            if (!rewrittenCommand || rewrittenCommand === originalCommand) return;

            input.command = rewrittenCommand;
        } catch {
            // RTK is optional and fail-open. If rewriting fails, run the original command.
        }
    });
}
