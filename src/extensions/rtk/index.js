/**
 * @module extensions/rtk
 * Optional RTK command rewrite extension for Harns agent invocations.
 */

/**
 * Register RTK command rewriting for agent bash tool calls.
 *
 * @param {import('@earendil-works/pi-coding-agent').ExtensionAPI} pi
 */
export default function rtkExtension(pi) {
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
