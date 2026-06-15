/**
 * @module shared/workflow/workflow-prompts
 * User prompts and agent request text used by workflow execution.
 */

import { CWD } from "../../constants.js";
import { loadPlan } from "../../plan-store.js";
import { getAgentDisplayName } from "../session/agents.js";
import { extractTasks, parseTaskDependencies, validateProjectTasks } from "./task-scheduling.js";

/**
 * Build the user-request text handed to the slicer agent.
 *
 * @param {string} planName
 * @param {import('../../tools/plan-written.js').TriageMeta | undefined} triageMeta
 * @returns {string}
 */
export function buildSlicerRequest(planName, triageMeta) {
    const lines = [
        `## Slice Plan: ${planName}`,
        "",
        `The architect has finished a design-only plan at plans/${planName}.md. The user approved the design.`,
        "Your job: read the plan, then append a Tasks section and per-slice detail blocks using the edit tool.",
        "Follow the slicer tasks format file referenced in your system prompt exactly.",
        "",
    ];
    if (triageMeta) {
        lines.push("## Triage Report");
        if (triageMeta.classification) lines.push(`- Classification: ${triageMeta.classification}`);
        if (triageMeta.complexity) lines.push(`- Complexity: ${triageMeta.complexity}`);
        if (triageMeta.summary) lines.push(`- Summary: ${triageMeta.summary}`);
        if (triageMeta.affectedPaths?.length) {
            lines.push(`- Affected paths: ${triageMeta.affectedPaths.join(", ")}`);
        }
        lines.push("");
    }
    lines.push(
        "Apply the self-check rules in your system prompt before editing. End your turn after the edit — do not " +
            "generate further text.",
    );
    return lines.join("\n");
}

/**
 * Ask user what to do after plan approval.
 *
 * @param {string} planName
 * @param {import('../ui/types.js').UiAPI} uiAPI
 * @returns {Promise<"proceed" | "save">}
 */
export async function askPostApproval(planName, uiAPI) {
    const title = `Plan "${planName}" approved! What next?`;
    const options = [
        { value: "proceed", label: "Proceed with execution" },
        { value: "save", label: "Save for later" },
    ];
    const choice = await uiAPI.promptSelect(title, options);
    return choice === "proceed" ? "proceed" : "save";
}

/**
 * Project-specific post-approval selection that also prints task list.
 *
 * @param {string} planName
 * @param {import('../ui/types.js').UiAPI} uiAPI
 * @param {Array<{ task: number, assignee: string, dependencies: string, description: string, writeScope?: string }>} [structuredTasks]
 * @returns {Promise<"proceed" | "save">}
 */
export async function askApprovalWithTasks(planName, uiAPI, structuredTasks) {
    const plan = await loadPlan(CWD, planName);

    let tasks = structuredTasks || [];
    if (tasks.length === 0 && plan) {
        try {
            tasks = extractTasks(plan.markdown);
            validateProjectTasks(tasks);
        } catch {
            // Proceed with 0 tasks; execution will report repair needed if markdown also fails.
        }
    }

    let title = `Project plan "${planName}" approved!`;
    if (tasks.length > 0) {
        title += `\nTasks:\n` +
            tasks.map((t) => `  ${t.task}. [${t.assignee}] ${t.description}`).join(
                "\n",
            );
    }

    const options = [
        {
            value: "proceed",
            label: "Proceed with execution (tasks run in dependency order)",
        },
        { value: "save", label: "Save for later" },
    ];

    const choice = await uiAPI.promptSelect(`${title}\nWhat next?`, options);
    return choice === "proceed" ? "proceed" : "save";
}

/**
 * @param {{ failedTasks: number[], results: Map<number, { status: string, error?: string }> }} executionResult
 * @param {import('../ui/types.js').UiAPI} uiAPI
 * @returns {Promise<boolean>}
 */
export async function askRetryFailedTasks(executionResult, uiAPI) {
    const { failedTasks } = executionResult;
    const msg = `[Harns] ${failedTasks.length} task(s) failed. Would you like to retry the failed tasks?`;
    return await uiAPI.promptSelect(msg, [
        { value: "yes", label: "Yes, retry failed tasks" },
        { value: "no", label: "No, finalize execution" },
    ]) === "yes";
}

/**
 * @param {{ results: Map<number, { status: string, error?: string }> }} result
 * @param {import('../ui/types.js').UiAPI} uiAPI
 */
export function reportExecutionSummary(result, uiAPI) {
    const { results } = result;
    let successCount = 0, failedCount = 0, blockedCount = 0;

    results.forEach((taskResult) => {
        if (taskResult.status === "success") successCount++;
        else if (taskResult.status === "failed") failedCount++;
        else if (taskResult.status === "blocked") blockedCount++;
    });

    const summary = `Execution Summary: ${successCount} success, ${failedCount} failed, ${blockedCount} blocked.`;
    uiAPI.appendSystemMessage(summary, false, "Harns");
}

/**
 * @param {{ task: number, description: string }} task
 * @param {string} agentName
 * @param {string | null} outputText
 * @returns {string}
 */
export function buildTaskResultDisplay(task, agentName, outputText) {
    return `Task ${task.task} (${getAgentDisplayName(agentName)}) — ${task.description}\n\n` +
        (outputText || "(no output)");
}

/**
 * @param {{ dependencies: string }} task
 * @param {Map<number, import('./types.js').TaskExecutionResult>} results
 * @returns {string}
 */
export function buildDependencyOutputsContext(task, results) {
    const outputs = parseTaskDependencies(task.dependencies)
        .map((dependencyId) => results.get(dependencyId))
        .filter((result) => result?.status === "success" && result.display)
        .map((result) => result?.display || "");

    return outputs.join("\n\n---\n\n");
}

/**
 * @param {string} planName
 * @param {string} planBody
 * @param {{ task: number, dependencies: string, description: string, writeScope?: string }} task
 * @param {Map<number, import('./types.js').TaskExecutionResult>} results
 * @returns {string}
 */
export function buildTaskAssignmentRequest(planName, planBody, task, results) {
    const dependencyOutputs = buildDependencyOutputsContext(task, results);
    return [
        "## Task Assignment",
        `You are assigned Task ${task.task} from the plan "${planName}". This is a PROJECT plan; only execute the assigned task, then call task_completed with a concise success or failure summary.`,
        "### Task Description",
        task.description,
        "### Dependencies",
        task.dependencies || "None",
        dependencyOutputs ? "### Dependency Outputs" : "",
        dependencyOutputs,
        "### Write Scope",
        task.writeScope || "unknown",
        "### Full Plan Context",
        planBody,
    ].filter(Boolean).join("\n\n");
}

/**
 * @param {string} planName
 * @param {string} planBody
 * @returns {string}
 */
export function buildEngineerRequest(planName, planBody) {
    return [
        `## Approved Plan: ${planName}`,
        "",
        "Execute the following plan step by step. This is a FEATURE request. Complete all Implementation Steps and the Verification Plan, then call task_completed with a concise success or failure summary.",
        "",
        planBody,
    ].join("\n");
}
