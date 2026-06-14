/**
 * @module shared/workflow/plan-lifecycle
 *
 * Central Plan Lifecycle state machine. Workflow callers should record Plan
 * Events here instead of mutating Plan Status directly.
 *
 * See docs/plan-lifecycle.md for the human-readable workflow.
 */

import { updatePlanFrontMatter } from "../../plan-store.js";

/**
 * @typedef {"draft"|"feedback"|"approved"|"ready_for_work"|"in_progress"|"failed"|"implemented"|"verified"} PlanStatus
 */

/**
 * @typedef {"review_feedback"|"review_approved"|"readiness_passed"|"execution_started"|"execution_failed"|"implementation_finished"|"validation_failed"|"validation_passed"|"recovery_reset"|"review_reopened"} PlanEvent
 */

/**
 * @typedef {Object} PlanEventDetails
 * @property {Partial<import('../../plan-store.js').PlanFrontMatter>} [triageMeta]
 * @property {string} [failureReason]
 * @property {string} [executionBaselineTree]
 * @property {() => Date} [now]
 */

/** @type {Record<PlanEvent, PlanStatus[]>} */
const ALLOWED_FROM = {
    review_feedback: ["draft", "feedback", "approved"],
    review_approved: ["draft", "feedback", "approved"],
    readiness_passed: ["approved"],
    execution_started: ["ready_for_work"],
    execution_failed: ["in_progress"],
    implementation_finished: ["in_progress"],
    validation_failed: ["implemented"],
    validation_passed: ["implemented"],
    recovery_reset: ["in_progress", "failed", "implemented"],
    review_reopened: ["ready_for_work", "in_progress", "failed", "implemented", "verified"],
};

/** @type {Record<PlanEvent, PlanStatus>} */
const EVENT_STATUS = {
    review_feedback: "feedback",
    review_approved: "approved",
    readiness_passed: "ready_for_work",
    execution_started: "in_progress",
    execution_failed: "failed",
    implementation_finished: "implemented",
    validation_failed: "implemented",
    validation_passed: "verified",
    recovery_reset: "ready_for_work",
    review_reopened: "feedback",
};

/**
 * @param {Date} date
 * @returns {string}
 */
function iso(date) {
    return date.toISOString();
}

/**
 * @param {PlanEvent} event
 * @param {PlanStatus} currentStatus
 */
function assertAllowedTransition(event, currentStatus) {
    const allowed = ALLOWED_FROM[event];
    if (!allowed.includes(currentStatus)) {
        throw new Error(
            `Invalid Plan Lifecycle transition: ${event} cannot apply to status "${currentStatus}". ` +
                `Allowed from: ${allowed.join(", ")}.`,
        );
    }
}

/**
 * @param {PlanEvent} event
 * @param {PlanStatus} currentStatus
 * @param {PlanEventDetails} details
 * @returns {Partial<import('../../plan-store.js').PlanFrontMatter>}
 */
export function buildPlanEventUpdates(event, currentStatus, details = {}) {
    assertAllowedTransition(event, currentStatus);

    const now = iso(details.now ? details.now() : new Date());
    /** @type {Partial<import('../../plan-store.js').PlanFrontMatter>} */
    const updates = {
        ...(details.triageMeta || {}),
        status: EVENT_STATUS[event],
        updatedAt: now,
    };

    if (event === "review_feedback") {
        updates.failureReason = null;
    }

    if (event === "review_approved") {
        updates.failureReason = null;
        updates.failedAt = null;
    }

    if (event === "readiness_passed") {
        updates.failureReason = null;
        updates.failedAt = null;
        updates.verifiedAt = null;
    }

    if (event === "execution_started") {
        updates.executionBaselineTree = details.executionBaselineTree;
        updates.failureReason = null;
        updates.failedAt = null;
        updates.implementedAt = null;
        updates.verifiedAt = null;
    }

    if (event === "execution_failed") {
        updates.failureReason = details.failureReason || "Execution failed before implementation finished.";
        updates.failedAt = now;
    }

    if (event === "implementation_finished") {
        updates.implementedAt = now;
        updates.failedAt = null;
    }

    if (event === "validation_failed") {
        updates.failureReason = details.failureReason || "Workflow Validation failed.";
    }

    if (event === "validation_passed") {
        updates.verifiedAt = now;
        updates.failureReason = null;
        updates.failedAt = null;
    }

    if (event === "recovery_reset") {
        updates.failureReason = null;
        updates.failedAt = null;
        updates.implementedAt = null;
        updates.verifiedAt = null;
    }

    if (event === "review_reopened") {
        updates.failureReason = null;
        updates.failedAt = null;
        updates.implementedAt = null;
        updates.verifiedAt = null;
        updates.executionBaselineTree = null;
    }

    return updates;
}

/**
 * Record a Plan Event and persist the resulting Plan Front Matter.
 *
 * @param {Object} opts
 * @param {string} opts.cwd
 * @param {string} opts.planName
 * @param {PlanEvent} opts.event
 * @param {PlanStatus} opts.currentStatus
 * @param {PlanEventDetails} [opts.details]
 * @returns {Promise<import('../../plan-store.js').PlanFrontMatter>}
 */
export async function recordPlanEvent({ cwd, planName, event, currentStatus, details = {} }) {
    const updates = buildPlanEventUpdates(event, currentStatus, details);
    return await updatePlanFrontMatter(cwd, planName, updates, details.triageMeta);
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isExecutablePlanStatus(status) {
    return status === "ready_for_work";
}
