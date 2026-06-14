/**
 * @module plan-store
 * Manages plan persistence: front matter injection, save/load/list, and
 * resumption of saved or external plans.
 *
 * Plans live in `<project root>/plans/` as markdown files with YAML front matter.
 * The plan "id" is the filename without .md.
 * External plans (missing front matter) get sensible defaults applied.
 */

import { extractYaml, test as hasFrontMatter } from "@std/front-matter";
import { basename, join, resolve } from "@std/path";
import { CLI_BIN, PLANS_DIR_NAME } from "./constants.js";

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Get the plans directory path for the current project.
 * @param {string} cwd - Project root
 * @returns {string}
 */
export function getPlansDir(cwd) {
    return join(cwd, PLANS_DIR_NAME);
}

/**
 * Ensure the plans directory exists.
 * @param {string} cwd
 * @returns {Promise<string>} The plans directory path
 */
export async function ensurePlansDir(cwd) {
    const dir = getPlansDir(cwd);
    try {
        await Deno.mkdir(dir, { recursive: true });
    } catch {
        // already exists, fine
    }
    return dir;
}

// ─── Front Matter ─────────────────────────────────────────────────────

/**
 * @typedef {Object} PlanFrontMatter
 * @property {"QUICK_FIX"|"FEATURE"|"PROJECT"} classification
 * @property {"LOW"|"MEDIUM"|"HIGH"} complexity
 * @property {string} summary - Brief description of what the plan addresses
 * @property {string[]} affectedPaths - Files that will be created/modified
 * @property {string} createdAt - ISO timestamp
 * @property {string} [updatedAt] - ISO timestamp (set on revision)
 * @property {"draft"|"feedback"|"approved"|"ready_for_work"|"in_progress"|"failed"|"implemented"|"verified"} status
 * @property {"internal"|"external"} [origin] - "internal" = created by a Harns agent; "external" = a pre-existing markdown file loaded from an arbitrary path and resumed with Harns
 * @property {string|null} [failureReason] - Concise durable failure detail for failed or unverified implemented plans
 * @property {string|null} [failedAt] - ISO timestamp when execution failed
 * @property {string|null} [implementedAt] - ISO timestamp when execution finished
 * @property {string|null} [verifiedAt] - ISO timestamp when validation passed
 * @property {string|null} [executionBaselineTree] - Git tree captured before execution started
 */

/**
 * Default front matter for plans.
 * @type {PlanFrontMatter}
 */
const DEFAULT_FRONT_MATTER = {
    classification: "FEATURE",
    complexity: "MEDIUM",
    summary: "",
    affectedPaths: [],
    get createdAt() {
        return new Date().toISOString();
    },
    status: "draft",
    origin: "internal",
};

/**
 * Escape a scalar for YAML double-quoted style.
 * @param {unknown} value
 * @returns {string}
 */
function escapeYamlDoubleQuoted(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Build YAML front matter string from a PlanFrontMatter object.
 * @param {PlanFrontMatter} fm
 * @returns {string}
 */
function formatFrontMatter(fm) {
    const lines = ["---"];
    lines.push(`classification: "${escapeYamlDoubleQuoted(fm.classification)}"`);
    lines.push(`complexity: "${escapeYamlDoubleQuoted(fm.complexity)}"`);
    lines.push(`summary: "${escapeYamlDoubleQuoted(fm.summary)}"`);
    lines.push(`affectedPaths:`);
    if (fm.affectedPaths.length === 0) {
        lines.push(`  []`);
    } else {
        for (const p of fm.affectedPaths) {
            lines.push(`  - "${escapeYamlDoubleQuoted(p)}"`);
        }
    }
    lines.push(`createdAt: "${escapeYamlDoubleQuoted(fm.createdAt)}"`);
    if (fm.updatedAt) {
        lines.push(`updatedAt: "${escapeYamlDoubleQuoted(fm.updatedAt)}"`);
    }
    lines.push(`status: "${escapeYamlDoubleQuoted(fm.status)}"`);
    if (fm.origin) lines.push(`origin: "${escapeYamlDoubleQuoted(fm.origin)}"`);
    if (fm.failureReason) lines.push(`failureReason: "${escapeYamlDoubleQuoted(fm.failureReason)}"`);
    if (fm.failedAt) lines.push(`failedAt: "${escapeYamlDoubleQuoted(fm.failedAt)}"`);
    if (fm.implementedAt) lines.push(`implementedAt: "${escapeYamlDoubleQuoted(fm.implementedAt)}"`);
    if (fm.verifiedAt) lines.push(`verifiedAt: "${escapeYamlDoubleQuoted(fm.verifiedAt)}"`);
    if (fm.executionBaselineTree) {
        lines.push(`executionBaselineTree: "${escapeYamlDoubleQuoted(fm.executionBaselineTree)}"`);
    }
    lines.push("---");
    return lines.join("\n");
}

/**
 * Normalize legacy statuses from older saved plans into the current lifecycle.
 *
 * @param {string | undefined} status
 * @returns {PlanFrontMatter["status"]}
 */
function normalizePlanStatus(status) {
    if (status === "completed") return "verified";
    if (status === "in_review") return "feedback";
    const allowed = new Set([
        "draft",
        "feedback",
        "approved",
        "ready_for_work",
        "in_progress",
        "failed",
        "implemented",
        "verified",
    ]);
    if (status && allowed.has(status)) {
        return /** @type {PlanFrontMatter["status"]} */ (status);
    }
    return DEFAULT_FRONT_MATTER.status;
}

/**
 * Return an optional front matter value, allowing explicit null to clear it.
 *
 * @param {Partial<PlanFrontMatter>} overrides
 * @param {Partial<PlanFrontMatter>} existingFm
 * @param {keyof PlanFrontMatter} key
 * @returns {string | null | undefined}
 */
function optionalFrontMatterValue(overrides, existingFm, key) {
    if (Object.hasOwn(overrides, key)) {
        return /** @type {string | null | undefined} */ (overrides[key] ?? undefined);
    }
    return /** @type {string | null | undefined} */ (existingFm[key]);
}

/**
 * Inject or update front matter on a plan's markdown content.
 * If front matter already exists, merge with existing values.
 *
 * @param {string} markdown - The plan content (may or may not have front matter)
 * @param {Partial<PlanFrontMatter>} overrides - Fields to inject/override
 * @returns {string} The markdown with front matter
 */
export function injectFrontMatter(markdown, overrides = {}) {
    /** @type {Partial<PlanFrontMatter>} */
    let existingFm = {};
    let body = markdown;

    if (hasFrontMatter(markdown)) {
        const { attrs, body: b } = extractYaml(markdown);
        existingFm = attrs || {};
        body = b;
    }

    const fm = {
        classification: overrides.classification ??
            existingFm.classification ??
            DEFAULT_FRONT_MATTER.classification,
        complexity: overrides.complexity ??
            existingFm.complexity ??
            DEFAULT_FRONT_MATTER.complexity,
        summary: overrides.summary ?? existingFm.summary ?? DEFAULT_FRONT_MATTER.summary,
        affectedPaths: overrides.affectedPaths ??
            existingFm.affectedPaths ??
            DEFAULT_FRONT_MATTER.affectedPaths,
        createdAt: overrides.createdAt ??
            existingFm.createdAt ??
            DEFAULT_FRONT_MATTER.createdAt,
        updatedAt: overrides.updatedAt ?? existingFm.updatedAt ?? new Date().toISOString(),
        status: normalizePlanStatus(overrides.status ?? existingFm.status),
        origin: overrides.origin ?? existingFm.origin ?? "internal",
        failureReason: optionalFrontMatterValue(overrides, existingFm, "failureReason"),
        failedAt: optionalFrontMatterValue(overrides, existingFm, "failedAt"),
        implementedAt: optionalFrontMatterValue(overrides, existingFm, "implementedAt"),
        verifiedAt: optionalFrontMatterValue(overrides, existingFm, "verifiedAt"),
        executionBaselineTree: optionalFrontMatterValue(overrides, existingFm, "executionBaselineTree"),
    };

    return formatFrontMatter(fm) + "\n" + body.trimStart();
}

/**
 * Parse front matter from a plan file. Returns defaults if missing.
 *
 * @param {string} markdown
 * @param {{ missingOrigin?: string }} [opts]
 * @returns {{ attrs: PlanFrontMatter, body: string }}
 */
export function parsePlanFrontMatter(markdown, opts = {}) {
    const missingOrigin = opts.missingOrigin || DEFAULT_FRONT_MATTER.origin;

    if (!hasFrontMatter(markdown)) {
        return {
            attrs: {
                ...DEFAULT_FRONT_MATTER,
                createdAt: new Date().toISOString(),
                origin: /** @type {"internal"|"external"} */ (missingOrigin),
            },
            body: markdown,
        };
    }
    const { attrs, body } = extractYaml(markdown);
    return {
        attrs: {
            classification: attrs.classification || DEFAULT_FRONT_MATTER.classification,
            complexity: attrs.complexity || DEFAULT_FRONT_MATTER.complexity,
            summary: attrs.summary || DEFAULT_FRONT_MATTER.summary,
            affectedPaths: attrs.affectedPaths || DEFAULT_FRONT_MATTER.affectedPaths,
            createdAt: attrs.createdAt || DEFAULT_FRONT_MATTER.createdAt,
            updatedAt: attrs.updatedAt,
            status: normalizePlanStatus(attrs.status),
            origin: attrs.origin || missingOrigin,
            failureReason: attrs.failureReason,
            failedAt: attrs.failedAt,
            implementedAt: attrs.implementedAt,
            verifiedAt: attrs.verifiedAt,
            executionBaselineTree: attrs.executionBaselineTree,
        },
        body,
    };
}

// ─── Save / Load / List ──────────────────────────────────────────────

/**
 * Save a plan to the plans directory with front matter.
 *
 * @param {string} cwd - Project root
 * @param {string} planName - Filename without .md (e.g., "add-dark-mode-toggle")
 * @param {string} content - Plan markdown content
 * @param {Partial<PlanFrontMatter>} [fmOverrides] - Front matter fields
 * @returns {Promise<string>} The full path where the plan was saved
 */
export async function savePlan(cwd, planName, content, fmOverrides = {}) {
    const dir = await ensurePlansDir(cwd);
    const withFm = injectFrontMatter(content, fmOverrides);
    const filePath = join(dir, `${planName}.md`);
    await Deno.writeTextFile(filePath, withFm);
    return filePath;
}

/**
 * Load a plan by name from the plans directory.
 *
 * @param {string} cwd
 * @param {string} planName - Filename without .md
 * @returns {Promise<{ path: string, markdown: string, attrs: PlanFrontMatter, body: string } | null>}
 */
export async function loadPlan(cwd, planName) {
    const filePath = join(getPlansDir(cwd), `${planName}.md`);
    try {
        const markdown = await Deno.readTextFile(filePath);
        const { attrs, body } = parsePlanFrontMatter(markdown);
        return { path: filePath, markdown, attrs, body };
    } catch {
        return null;
    }
}

/**
 * Load an external plan (a pre-existing markdown file not created by Harns)
 * from any path. Applies defaults if front matter is missing.
 *
 * @param {string} absolutePath - Absolute path to the plan file
 * @returns {Promise<{ path: string, markdown: string, attrs: PlanFrontMatter, body: string }>}
 */
export async function loadExternalPlan(absolutePath) {
    const markdown = await Deno.readTextFile(absolutePath);
    const { attrs, body } = parsePlanFrontMatter(markdown, {
        missingOrigin: "external",
    });
    // If front matter was missing, rewrite with defaults injected
    if (!hasFrontMatter(markdown)) {
        const withFm = injectFrontMatter(markdown, { origin: "external" });
        return { path: absolutePath, markdown: withFm, attrs, body };
    }
    return { path: absolutePath, markdown, attrs, body };
}

/**
 * Update the status field in a plan's front matter.
 *
 * @param {string} cwd
 * @param {string} planName
 * @param {string} status
 * @returns {Promise<void>}
 */
/**
 * Remove a leading front matter block if present, even if malformed.
 * @param {string} markdown
 * @returns {string}
 */
function stripLeadingFrontMatterBlock(markdown) {
    if (!markdown.startsWith("---")) return markdown;
    const close = markdown.indexOf("\n---", 3);
    if (close === -1) return markdown;
    const afterClose = markdown.slice(close + 4);
    return afterClose.startsWith("\n") ? afterClose.slice(1) : afterClose;
}

/**
 * Update the status field in a plan's front matter.
 *
 * If the plan file exists but has malformed front matter,
 * this function self-heals by rewriting front matter using
 * provided recovery metadata and then applying the target status.
 *
 * @param {string} cwd
 * @param {string} planName
 * @param {PlanFrontMatter["status"]} status
 * @param {Partial<PlanFrontMatter>} [recoveryAttrs]
 * @returns {Promise<void>}
 */
export async function updatePlanStatus(
    cwd,
    planName,
    status,
    recoveryAttrs = {},
) {
    const plan = await loadPlan(cwd, planName);
    if (plan) {
        const withFm = injectFrontMatter(plan.body, { ...plan.attrs, status });
        await Deno.writeTextFile(plan.path, withFm);

        return;
    }

    const filePath = join(getPlansDir(cwd), `${planName}.md`);
    let markdown;
    try {
        markdown = await Deno.readTextFile(filePath);
    } catch {
        throw new Error(`Plan not found: ${planName}`);
    }

    const body = stripLeadingFrontMatterBlock(markdown);
    const healed = injectFrontMatter(body, {
        ...recoveryAttrs,
        status,
        updatedAt: new Date().toISOString(),
    });
    await Deno.writeTextFile(filePath, healed);
}

/**
 * Update arbitrary plan front matter fields while preserving the body.
 * Passing null for optional fields clears them.
 *
 * @param {string} cwd
 * @param {string} planName
 * @param {Partial<PlanFrontMatter>} updates
 * @param {Partial<PlanFrontMatter>} [recoveryAttrs]
 * @returns {Promise<PlanFrontMatter>}
 */
export async function updatePlanFrontMatter(
    cwd,
    planName,
    updates,
    recoveryAttrs = {},
) {
    const plan = await loadPlan(cwd, planName);
    if (plan) {
        const attrs = { ...plan.attrs, ...updates, updatedAt: updates.updatedAt ?? new Date().toISOString() };
        const withFm = injectFrontMatter(plan.body, attrs);
        await Deno.writeTextFile(plan.path, withFm);
        return parsePlanFrontMatter(withFm).attrs;
    }

    const filePath = join(getPlansDir(cwd), `${planName}.md`);
    let markdown;
    try {
        markdown = await Deno.readTextFile(filePath);
    } catch {
        throw new Error(`Plan not found: ${planName}`);
    }

    const body = stripLeadingFrontMatterBlock(markdown);
    const attrs = { ...recoveryAttrs, ...updates, updatedAt: updates.updatedAt ?? new Date().toISOString() };
    const healed = injectFrontMatter(body, attrs);
    await Deno.writeTextFile(filePath, healed);
    return parsePlanFrontMatter(healed).attrs;
}

/**
 * List all saved plans in the project's plans directory.
 *
 * @param {string} cwd
 * @returns {Promise<Array<{ name: string, path: string, attrs: PlanFrontMatter }>>}
 */
export async function listPlans(cwd) {
    const dir = getPlansDir(cwd);
    const results = [];
    try {
        for await (const entry of Deno.readDir(dir)) {
            if (!entry.isFile || !entry.name.endsWith(".md")) continue;
            const name = entry.name.replace(/\.md$/, "");
            const filePath = join(dir, entry.name);
            try {
                const markdown = await Deno.readTextFile(filePath);
                const { attrs } = parsePlanFrontMatter(markdown);
                results.push({ name, path: filePath, attrs });
            } catch {
                // skip unreadable files
            }
        }
    } catch {
        // plans dir doesn't exist yet
    }
    return results;
}

/**
 * Resolve a plan name or path argument to a loadable plan.
 * If the argument looks like an absolute/relative path (contains / or \),
 * treat it as an external plan. Otherwise, look in the project plans dir.
 *
 * @param {string} cwd
 * @param {string} arg - Plan name (e.g., "add-dark-mode") or file path
 * @returns {Promise<{ path: string, markdown: string, attrs: PlanFrontMatter, body: string, planName: string }>}
 */
export async function resolvePlan(cwd, arg) {
    // Check if it's a path (absolute or relative with separators)
    const isPath = arg.includes("/") || arg.includes("\\") || arg.endsWith(".md");

    if (isPath) {
        const absPath = resolve(cwd, arg);
        const plan = await loadExternalPlan(absPath);
        const planName = basename(absPath, ".md");
        return { ...plan, planName };
    }

    const plan = await loadPlan(cwd, arg);
    if (!plan) {
        throw new Error(
            `Plan not found: ${arg}. Use '${CLI_BIN} plans' to list available plans.`,
        );
    }
    return { ...plan, planName: arg };
}
