/**
 * Server-only Plan adapter for the read-only Workspace.
 */

import {
    countChildPlanProgress,
    findPlanById,
    groupPlanHierarchy,
    isChildFeaturePlan,
    isEpicPlan,
    listPlanResources,
} from "../../../plan-store.js";

export const ACTIVE_STATUSES = [
    "draft",
    "feedback",
    "approved",
    "ready_for_decomposition",
    "ready_for_work",
    "in_progress",
    "failed",
    "implemented",
];
export const CLOSED_STATUSES = ["verified", "closed_without_verification"];
export const ON_HOLD_STATUSES = ["on_hold"];

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? /** @type {Record<string, unknown>} */ (value)
        : {};
}

/**
 * @param {any} resource
 */
export function serializePlanSummary(resource) {
    const attrs = safeObject(resource.attrs);
    return {
        planId: resource.planId,
        planName: resource.planName || resource.name,
        name: resource.planName || resource.name,
        attrs,
        relativePath: resource.relativePath,
        status: attrs.status || "draft",
        classification: attrs.classification || "FEATURE",
        type: attrs.type || "",
        title: attrs.title || resource.planName || resource.name,
        summary: attrs.summary || "",
        complexity: attrs.complexity || "",
        createdAt: attrs.createdAt || "",
        parentPlan: attrs.parentPlan || "",
        dependsOn: Array.isArray(attrs.dependencies)
            ? attrs.dependencies
            : Array.isArray(attrs.dependsOn)
            ? attrs.dependsOn
            : [],
        dependencies: Array.isArray(attrs.dependencies) ? attrs.dependencies : [],
        worktreeStatus: attrs.worktreeStatus || "",
        worktreeBranch: attrs.worktreeBranch || "",
        humanReviewMode: attrs.humanReviewMode || "",
        epicCompletionMode: attrs.epicCompletionMode || "",
        epicDoneEnoughSummary: attrs.epicDoneEnoughSummary || "",
        isEpic: isEpicPlan(attrs),
        isChild: isChildFeaturePlan(resource),
        hierarchyRole: isEpicPlan(attrs) ? "epic" : isChildFeaturePlan(resource) ? "child" : "top-level",
    };
}

/**
 * @param {ReturnType<typeof serializePlanSummary>[]} plans
 */
function annotatePlanHierarchy(plans) {
    const epicNames = new Set(plans.filter((plan) => plan.isEpic).map((plan) => plan.name));
    return plans.map((plan) => {
        const hierarchyRole = plan.isEpic
            ? "epic"
            : plan.isChild && !epicNames.has(plan.parentPlan)
            ? "orphan-child"
            : plan.isChild
            ? "child"
            : "top-level";
        return { ...plan, hierarchyRole };
    });
}

/**
 * @param {any} resource
 * @param {ReturnType<typeof serializePlanSummary>[]} [plans]
 */
export function serializePlanDetail(resource, plans) {
    const summary = plans?.find((plan) => plan.planId === resource.planId) || serializePlanSummary(resource);
    return {
        ...summary,
        frontMatter: safeObject(resource.attrs),
        body: resource.body || "",
        markdown: resource.markdown || "",
        readOnly: true,
    };
}

/**
 * @param {unknown} error
 * @returns {{ error: string, repair: string }}
 */
export function serializePlanError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const repair = message.includes("Duplicate planId") || message.includes("duplicate")
        ? "Repair duplicate planId values in Plan front matter so each non-archived Plan has a unique planId."
        : "Check Plan front matter and ensure the requested planId belongs to a non-archived Plan in this checkout.";
    return { error: message, repair };
}

/**
 * @param {string} cwd
 */
export async function loadPlanSummaries(cwd) {
    const resources = await listPlanResources(cwd);
    return annotatePlanHierarchy(resources.map(serializePlanSummary));
}

/**
 * @param {string} cwd
 * @param {string} planId
 */
export async function loadPlanDetail(cwd, planId) {
    const resource = await findPlanById(cwd, planId);
    const summaries = await loadPlanSummaries(cwd);
    return serializePlanDetail(resource, summaries);
}

/**
 * @param {ReturnType<typeof serializePlanSummary>[]} plans
 * @param {string[]} statuses
 */
function hierarchyForPlans(plans, statuses) {
    const hierarchy = /** @type {any} */ (groupPlanHierarchy(/** @type {any} */ (plans)));
    const allowed = new Set(statuses);
    const hasAllowedStatus = (/** @type {ReturnType<typeof serializePlanSummary>} */ plan) =>
        allowed.has(String(plan.status));
    return {
        epics: hierarchy.epics
            .map((/** @type {any} */ epic) => {
                const children = (hierarchy.childrenByParent.get(epic.name) || []).filter(hasAllowedStatus);
                return {
                    ...epic,
                    childProgress: countChildPlanProgress(hierarchy.childrenByParent.get(epic.name) || []),
                    children,
                };
            })
            .filter((/** @type {any} */ epic) => hasAllowedStatus(epic) || epic.children.length > 0),
        standalone: hierarchy.standalone.filter(hasAllowedStatus),
        orphanChildren: hierarchy.orphanChildren.filter(hasAllowedStatus),
    };
}

/**
 * @param {ReturnType<typeof serializePlanSummary>[]} plans
 */
export function buildBoardGroups(plans) {
    return {
        active: hierarchyForPlans(plans, ACTIVE_STATUSES),
        closed: hierarchyForPlans(plans, CLOSED_STATUSES),
        onHold: hierarchyForPlans(plans, ON_HOLD_STATUSES),
    };
}

/**
 * @param {string} cwd
 */
export async function loadBoard(cwd) {
    const plans = await loadPlanSummaries(cwd);
    return { plans, groups: buildBoardGroups(plans) };
}

/**
 * @param {string} cwd
 */
export function workspaceMetadata(cwd) {
    return {
        projectName: cwd.split(/[\\/]/).filter(Boolean).at(-1) || cwd,
        readOnly: true,
        supportedViews: ["active", "closed", "on-hold"],
        statuses: {
            active: ACTIVE_STATUSES,
            closed: CLOSED_STATUSES,
            onHold: ON_HOLD_STATUSES,
        },
        capabilities: {
            board: true,
            detail: true,
            mutations: false,
            dragDrop: false,
            bodyEditing: false,
        },
    };
}
