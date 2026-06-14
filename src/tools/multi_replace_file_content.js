/**
 * @module tools/multi_replace_file_content
 *
 * Custom tool for performing multiple exact-text replacements in a single file.
 * Unlike the built-in `edit` tool (which also supports multiple edits), this
 * tool is explicitly named "multi_replace_file_content" for better discoverability
 * and clarity — agents can use it when they need to replace several disjoint
 * blocks of text in one file within a single tool call.
 *
 * All edits are matched against the ORIGINAL file content (not incrementally).
 * Edits must target unique, non-overlapping regions.
 */

import { isAbsolute, join } from "@std/path";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";

/** @import { AgentToolResult } from "@earendil-works/pi-coding-agent" */

// ---------------------------------------------------------------------------
// Parameter Schema
// ---------------------------------------------------------------------------

const replaceEditSchema = Type.Object({
    oldText: Type.String({
        description:
            "Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call.",
    }),
    newText: Type.String({ description: "Replacement text for this targeted edit." }),
}, { additionalProperties: false });

const toolParams = Type.Object({
    path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
    edits: Type.Array(replaceEditSchema, {
        description:
            "One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits. If two changes touch the same block or nearby lines, merge them into one edit instead.",
    }),
}, { additionalProperties: false });

// ---------------------------------------------------------------------------
// Helpers (inlined to avoid depending on non-exported pi internals)
// ---------------------------------------------------------------------------

/**
 * Strip UTF-8 BOM if present.
 * @param {string} content
 * @returns {{ bom: string, text: string }}
 */
function stripBom(content) {
    if (content.startsWith("\uFEFF")) {
        return { bom: "\uFEFF", text: content.slice(1) };
    }
    return { bom: "", text: content };
}

/**
 * Normalize line endings to LF.
 * @param {string} text
 * @returns {string}
 */
function normalizeToLF(text) {
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Restore original line endings after edit.
 * @param {string} text
 * @param {string} ending
 * @returns {string}
 */
function restoreLineEndings(text, ending) {
    if (ending === "\r\n") {
        return text.replace(/\n/g, "\r\n");
    }
    return text;
}

/**
 * Detect the dominant line ending in content.
 * @param {string} content
 * @returns {string}
 */
function detectLineEnding(content) {
    const crlfIdx = content.indexOf("\r\n");
    const lfIdx = content.indexOf("\n");
    if (lfIdx === -1) return "\n";
    if (crlfIdx === -1) return "\n";
    return crlfIdx < lfIdx ? "\r\n" : "\n";
}

/**
 * Resolve a path relative to cwd, handling ~ expansion.
 * @param {string} filePath
 * @param {string} cwd
 * @returns {string}
 */
function resolveToCwd(filePath, cwd) {
    const expanded = filePath.startsWith("~") ? (Deno.env.get("HOME") || "") + filePath.slice(1) : filePath;
    if (isAbsolute(expanded)) return expanded;
    return join(cwd, expanded);
}

/**
 * Simple diff generation: shows +/- lines for changed regions.
 * @param {string} oldContent
 * @param {string} newContent
 * @returns {{ diff: string, firstChangedLine: number | undefined }}
 */
function generateDiffString(oldContent, newContent) {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    const maxLen = Math.max(oldLines.length, newLines.length);
    const pad = String(maxLen).length;
    const result = [];
    let firstChangedLine;

    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
        const oldLine = i < oldLines.length ? oldLines[i] : undefined;
        const newLine = i < newLines.length ? newLines[i] : undefined;

        if (oldLine !== newLine) {
            if (firstChangedLine === undefined) firstChangedLine = i + 1;
            if (oldLine !== undefined) {
                result.push(`-${String(i + 1).padStart(pad)} ${oldLine}`);
            }
            if (newLine !== undefined) {
                result.push(`+${String(i + 1).padStart(pad)} ${newLine}`);
            }
        } else {
            result.push(` ${String(i + 1).padStart(pad)} ${oldLine}`);
        }
    }

    return { diff: result.join("\n"), firstChangedLine };
}

// ---------------------------------------------------------------------------
// Edit Application
// ---------------------------------------------------------------------------

/**
 * Apply edits against the original normalized content.
 * @param {string} normalizedContent - LF-normalized file content
 * @param {Array<{oldText: string, newText: string}>} edits
 * @param {string} path - file path for error messages
 * @returns {{ baseContent: string, newContent: string }}
 */
function applyEdits(normalizedContent, edits, path) {
    // Normalize edit text to LF
    const normalizedEdits = edits.map((e) => ({
        oldText: normalizeToLF(e.oldText),
        newText: normalizeToLF(e.newText),
    }));

    // Validate non-empty oldText
    for (let i = 0; i < normalizedEdits.length; i++) {
        if (normalizedEdits[i].oldText.length === 0) {
            const label = normalizedEdits.length === 1 ? "oldText" : `edits[${i}].oldText`;
            throw new Error(`${label} must not be empty in ${path}.`);
        }
    }

    // Find matches (all against original content)
    /** @type {Array<{index: number, length: number, newText: string, editIdx: number}>} */
    const matches = [];

    for (let i = 0; i < normalizedEdits.length; i++) {
        const { oldText } = normalizedEdits[i];
        const idx = normalizedContent.indexOf(oldText);
        if (idx === -1) {
            const label = normalizedEdits.length === 1 ? "The old text" : `edits[${i}].oldText`;
            throw new Error(
                `${label} was not found in ${path}. ` +
                    `It must match exactly including all whitespace and newlines.`,
            );
        }
        // Check uniqueness
        const nextIdx = normalizedContent.indexOf(oldText, idx + 1);
        if (nextIdx !== -1) {
            const label = normalizedEdits.length === 1 ? "The text" : `edits[${i}].oldText`;
            throw new Error(
                `${label} was found at multiple locations in ${path}. ` +
                    `Each oldText must match exactly one location. Please provide more context.`,
            );
        }
        matches.push({
            index: idx,
            length: oldText.length,
            newText: normalizedEdits[i].newText,
            editIdx: i,
        });
    }

    // Sort by position and check for overlap
    matches.sort((a, b) => a.index - b.index);
    for (let i = 1; i < matches.length; i++) {
        const prev = matches[i - 1];
        const curr = matches[i];
        if (prev.index + prev.length > curr.index) {
            throw new Error(
                `edits[${prev.editIdx}] and edits[${curr.editIdx}] overlap in ${path}. ` +
                    `Merge them into one edit or target disjoint regions.`,
            );
        }
    }

    // Apply in reverse order to preserve offsets
    let newContent = normalizedContent;
    for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        newContent = newContent.substring(0, m.index) + m.newText + newContent.substring(m.index + m.length);
    }

    if (normalizedContent === newContent) {
        throw new Error(
            `No changes made to ${path}. The replacement(s) produced identical content. ` +
                `This might indicate the oldText and newText are the same.`,
        );
    }

    return { baseContent: normalizedContent, newContent };
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

/**
 * Create the multi_replace_file_content tool definition.
 *
 * @param {string} cwd - Current working directory
 * @returns {import('@earendil-works/pi-coding-agent').ToolDefinition}
 */
export function createMultiReplaceFileContentTool(cwd) {
    return defineTool({
        name: "multi_replace_file_content",
        label: "Multi-Replace File Content",
        description: "Edit a single file by replacing multiple exact-text blocks in one call. " +
            "Provide a path and an array of edits (each with oldText/newText). " +
            "Each oldText must match a unique, non-overlapping region in the original file. " +
            "All edits are matched against the original file content (not incrementally). " +
            "If two changes touch the same block or nearby lines, merge them into one edit.",
        promptSnippet:
            "Perform multiple simultaneous text replacements in a single file, matching against original content",
        promptGuidelines: [
            "Use multi_replace_file_content when you need to replace several disjoint blocks in one file with a single tool call",
            "Each edits[].oldText is matched against the original file, not after earlier edits are applied",
            "Keep edits[].oldText as small as possible while still being unique in the file",
            "Do not emit overlapping or nested edits — merge nearby changes into one edit",
        ],
        parameters: toolParams,
        async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
            const { path: filePath, edits } = params;
            const absolutePath = resolveToCwd(filePath, cwd);

            // Check file exists and is accessible
            try {
                await Deno.stat(absolutePath);
            } catch (err) {
                const error = /** @type {Error} */ (err);
                const msg = error instanceof Deno.errors.NotFound
                    ? `Could not find file: ${filePath}`
                    : `Could not access file: ${filePath}. ${error.message}`;
                return {
                    content: [{ type: "text", text: msg }],
                    details: /** @type {any} */ (null),
                    isError: true,
                };
            }

            try {
                const rawContent = await Deno.readTextFile(absolutePath);
                const { bom, text: content } = stripBom(rawContent);
                const originalEnding = detectLineEnding(content);
                const normalizedContent = normalizeToLF(content);

                const { baseContent, newContent } = applyEdits(normalizedContent, edits, filePath);

                const finalContent = bom + restoreLineEndings(newContent, originalEnding);
                await Deno.writeTextFile(absolutePath, finalContent);

                const { diff, firstChangedLine } = generateDiffString(baseContent, newContent);

                const editCount = edits.length;
                const noun = editCount === 1 ? "block" : "blocks";

                return {
                    content: [{
                        type: "text",
                        text: `Successfully replaced ${editCount} ${noun} in ${filePath}.`,
                    }],
                    details: { diff, firstChangedLine },
                };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text", text: errorMessage }],
                    details: /** @type {any} */ (null),
                    isError: true,
                };
            }
        },
    });
}
