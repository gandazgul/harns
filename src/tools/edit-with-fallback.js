/**
 * @module tools/edit-with-fallback
 *
 * Wraps the pi-coding-agent `edit` tool so that when an edit fails,
 * the error response includes the file's current contents (up to 1000 lines).
 * This lets the agent see what's on disk and retry with corrected edits instead
 * of guessing blindly.
 *
 * Registered as a custom tool named "edit" which overrides the built-in
 * via pi-coding-agent's tool registry (custom tools take precedence).
 */

import { createEditToolDefinition } from "@earendil-works/pi-coding-agent";
import { isAbsolute, join } from "@std/path";

const MAX_FALLBACK_LINES = 1000;

/**
 * Create an edit tool definition that returns file contents on failure.
 * Wraps the original pi-coding-agent edit tool and catches errors,
 * reading the file to include in the error response.
 *
 * @param {string} cwd - Current working directory.
 * @returns {import('@earendil-works/pi-coding-agent').ToolDefinition<any, any>}
 */
export function createEditWithFallbackToolDefinition(cwd) {
    const original = createEditToolDefinition(cwd);
    const originalExecute = original.execute;

    original.execute = async (toolCallId, params, signal, onUpdate, ctx) => {
        try {
            return await originalExecute(toolCallId, params, signal, onUpdate, ctx);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const path = typeof params.path === "string" ? params.path : "";
            if (!path) throw error;

            const absolutePath = isAbsolute(path) ? path : join(cwd, path);

            try {
                const content = await Deno.readTextFile(absolutePath);
                const lines = content.split("\n");
                const chunk = lines.slice(0, MAX_FALLBACK_LINES).join("\n");
                const totalLines = lines.length;

                const message = totalLines > MAX_FALLBACK_LINES
                    ? `Edit failed: ${errorMessage}\n\n` +
                        `File exists on disk with ${totalLines} lines. ` +
                        `Showing first ${MAX_FALLBACK_LINES} lines so you can inspect and retry:\n\n` +
                        chunk
                    : `Edit failed: ${errorMessage}\n\n` +
                        `File exists on disk (${totalLines} lines). Contents:\n\n` +
                        chunk;

                return {
                    content: [{ type: "text", text: message }],
                    details: undefined,
                };
            } catch {
                // File doesn't exist or can't be read — just rethrow original error.
                throw error;
            }
        }
    };

    return original;
}
