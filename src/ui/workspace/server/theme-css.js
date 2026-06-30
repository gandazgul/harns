/**
 * @module ui/workspace/server/theme-css
 * Converts the active agent theme into workspace CSS variables.
 */

import { getSettingsManager } from "../../../shared/settings.js";
import { applyPersistedTheme, initRunWieldTheme, theme } from "../../../shared/ui/theme.js";

/**
 * @typedef {Object} ThemeSnapshot
 * @property {string} [name]
 * @property {Record<string, string | number>} [fgColors]
 * @property {Record<string, string | number>} [bgColors]
 */

/**
 * @typedef {Object} ThemeTokenMapping
 * @property {string} css
 * @property {"fgColors" | "bgColors"} source
 * @property {string} token
 * @property {string} fallback
 */

/** @type {ThemeTokenMapping[]} */
const WORKSPACE_THEME_TOKEN_MAP = [
    { css: "--rw-page-bg", source: "bgColors", token: "toolPendingBg", fallback: "#0b1020" },
    { css: "--rw-surface", source: "bgColors", token: "toolPendingBg", fallback: "#0f172a" },
    { css: "--rw-surface-raised", source: "bgColors", token: "selectedBg", fallback: "#111827" },
    { css: "--rw-surface-muted", source: "bgColors", token: "customMessageBg", fallback: "#1e293b" },
    { css: "--rw-surface-strong", source: "bgColors", token: "userMessageBg", fallback: "#172033" },
    { css: "--rw-text", source: "fgColors", token: "text", fallback: "#e2e8f0" },
    { css: "--rw-text-strong", source: "fgColors", token: "toolTitle", fallback: "#ffffff" },
    { css: "--rw-text-muted", source: "fgColors", token: "muted", fallback: "#cbd5e1" },
    { css: "--rw-text-dim", source: "fgColors", token: "dim", fallback: "#94a3b8" },
    { css: "--rw-accent", source: "fgColors", token: "accent", fallback: "#60a5fa" },
    { css: "--rw-accent-strong", source: "fgColors", token: "borderAccent", fallback: "#93c5fd" },
    { css: "--rw-accent-text", source: "fgColors", token: "mdHeading", fallback: "#bfdbfe" },
    { css: "--rw-border", source: "fgColors", token: "borderMuted", fallback: "#334155" },
    { css: "--rw-border-strong", source: "fgColors", token: "border", fallback: "#475569" },
    { css: "--rw-success", source: "fgColors", token: "success", fallback: "#22c55e" },
    { css: "--rw-error", source: "fgColors", token: "error", fallback: "#ef4444" },
    { css: "--rw-warning", source: "fgColors", token: "warning", fallback: "#f59e0b" },
    { css: "--rw-code", source: "fgColors", token: "mdCode", fallback: "#85cbbf" },
];

/**
 * @param {string | number | undefined} value
 * @param {string} fallback
 * @returns {string}
 */
function cssColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
    return fallback;
}

/**
 * @param {string | undefined} name
 * @returns {string}
 */
function cssString(name) {
    return (name || "default").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

/**
 * @param {ThemeSnapshot} themeSnapshot
 * @returns {string}
 */
export function renderWorkspaceThemeCss(themeSnapshot) {
    const lines = [
        ":root {",
        `    --rw-theme-name: "${cssString(themeSnapshot.name)}";`,
    ];

    for (const mapping of WORKSPACE_THEME_TOKEN_MAP) {
        const source = themeSnapshot[mapping.source] || {};
        lines.push(`    ${mapping.css}: ${cssColor(source[mapping.token], mapping.fallback)};`);
    }

    lines.push("}");
    lines.push("");
    return lines.join("\n");
}

/**
 * @returns {Promise<string>}
 */
export async function loadWorkspaceThemeCss() {
    initRunWieldTheme();
    const settings = getSettingsManager();
    await settings.reload?.();
    await applyPersistedTheme();
    return renderWorkspaceThemeCss(/** @type {ThemeSnapshot} */ (/** @type {unknown} */ (theme)));
}
