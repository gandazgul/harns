#!/usr/bin/env -S deno run --allow-run
/**
 * CI entry point — runs the project CI pipeline.
 * Invoked by: deno run ci (via sloppy-imports or explicit path)
 */
const cmd = new Deno.Command("deno", {
    args: ["task", "ci"],
    cwd: Deno.cwd(),
    stdout: "inherit",
    stderr: "inherit",
});
const { success, code } = await cmd.output();
if (!success) Deno.exit(code ?? 1);
