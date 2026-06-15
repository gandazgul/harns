/**
 * @module shared/workflow/workflow-results
 * Helpers for extracting workflow outcomes from agent message streams.
 */

/**
 * Extract the last text output from the agent's assistant messages.
 * Scans messages in reverse, checking all content blocks to handle cases where
 * tool_use blocks appear alongside text.
 *
 * @param {import('@earendil-works/pi-agent-core').AgentMessage[]} messages
 * @returns {string | null}
 */
export function extractAssistantOutput(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (!("role" in msg) || msg.role !== "assistant") continue;
        if (!Array.isArray(msg.content)) continue;
        for (const block of msg.content) {
            if (block && typeof block === "object" && "type" in block && block.type === "text" && block.text?.trim()) {
                return block.text.trim();
            }
        }
    }

    return null;
}

/**
 * @typedef {"approved_execute" | "saved" | "feedback" | "canceled" | "repair_required" | "no_call"} PlanOutcome
 */

/**
 * @typedef {Object} PlanOutcomeResult
 * @property {PlanOutcome} outcome
 * @property {string} [planName]
 * @property {Array<{ task: number, assignee: string, dependencies: string, description: string, writeScope?: string }>} [tasks]
 * @property {import('../../tools/plan-written.js').TriageMeta} [triageMeta]
 */

/**
 * Read the latest plan_written tool result's outcome from a message stream.
 *
 * @param {import('@earendil-works/pi-agent-core').AgentMessage[]} messages
 * @returns {PlanOutcomeResult | null}
 */
export function readLatestPlanOutcome(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (
            msg && "role" in msg && msg.role === "toolResult" &&
            "toolName" in msg && msg.toolName === "plan_written"
        ) {
            // @ts-ignore details set by tool implementation
            const details = msg.details || {};
            const outcome = details.outcome;
            if (outcome) {
                return {
                    outcome,
                    planName: details.planName,
                    tasks: details.tasks,
                    triageMeta: details.triageMeta,
                };
            }
        }
    }
    return null;
}

/**
 * Read the latest task_completed tool result's outcome from a message stream.
 *
 * @param {import('@earendil-works/pi-agent-core').AgentMessage[]} messages
 * @returns {boolean}
 */
export function readLatestTaskCompletedOutcome(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (
            msg && "role" in msg && msg.role === "toolResult" &&
            "toolName" in msg && msg.toolName === "task_completed"
        ) {
            // @ts-ignore details set by tool implementation
            const details = msg.details || {};
            if (details.outcome === "task_completed") {
                return true;
            }
        }
    }
    return false;
}
