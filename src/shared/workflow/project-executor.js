/**
 * @module shared/workflow/project-executor
 * Parallel PROJECT task execution against transient sub-sessions.
 */

import { join } from "@std/path";
import { AGENTS, MAX_PARALLEL_TASKS } from "../../constants.js";
import { runAgentSession } from "../session/session.js";
import { getAgentDisplayName } from "../session/agents.js";
import { createSilentUiApi } from "../ui/api.js";
import { selectNonConflictingTasks } from "./task-scheduling.js";
import { extractAssistantOutput, readLatestTaskCompletedOutcome } from "./workflow-results.js";
import { buildTaskAssignmentRequest, buildTaskResultDisplay } from "./workflow-prompts.js";

/**
 * Execute project tasks in parallel against in-memory sub-sessions. Each task
 * runs on a transient SessionManager.inMemory() and appends one custom message
 * entry to the root session manager when it finishes.
 *
 * @param {string} planName
 * @param {string} planBody
 * @param {Array<{ task: number, assignee: string, dependencies: string, description: string, writeScope?: string }>} tasks
 * @param {import('../ui/types.js').UiAPI} uiAPI
 * @param {number[]} [seedFailedTasks]
 * @param {(runningTasks: Array<{task: number, assignee: string, description: string}>) => void} [onRunningTasksChange]
 * @param {import('@earendil-works/pi-coding-agent').SessionManager} [sessionManager]
 * @param {Map<number, import('./types.js').TaskExecutionResult>} [seedResults]
 * @param {typeof runAgentSession} [agentSessionRunner]
 */
export async function executeProjectTasks(
    planName,
    planBody,
    tasks,
    uiAPI,
    seedFailedTasks = [],
    onRunningTasksChange,
    sessionManager,
    seedResults = new Map(),
    agentSessionRunner = runAgentSession,
) {
    /** @type {Map<number, import('./types.js').TaskExecutionResult>} */
    const results = new Map();
    const retryTaskIds = new Set(seedFailedTasks);
    const pending = new Set(seedFailedTasks.length > 0 ? seedFailedTasks : tasks.map((task) => task.task));
    const running = new Set();

    if (seedFailedTasks.length > 0) {
        const processed = tasks.filter((task) => !retryTaskIds.has(task.task)).map((task) => task.task);
        processed.forEach((id) => {
            const seedResult = seedResults.get(id);
            results.set(id, seedResult?.status === "success" ? seedResult : { status: "success" });
        });
    }

    while (results.size < tasks.length) {
        const ready = tasks.filter((task) => {
            if (!pending.has(task.task)) return false;
            const deps = (task.dependencies || "").split(",").map((dependency) => dependency.trim()).filter((
                dependency,
            ) => dependency && dependency.toLowerCase() !== "none");
            return deps.every((dependency) => {
                const depId = parseInt(dependency);
                if (isNaN(depId)) return true;
                return results.has(depId) && results.get(depId)?.status === "success";
            });
        });

        const runningTasks = tasks.filter((task) => running.has(task.task));
        const toLaunch = selectNonConflictingTasks(ready, runningTasks, MAX_PARALLEL_TASKS - running.size);

        if (toLaunch.length === 0 && running.size === 0 && pending.size > 0) {
            const remaining = Array.from(pending);
            remaining.forEach((id) => {
                results.set(id, { status: "blocked" });
            });
            break;
        }

        const launches = toLaunch.map(async (task) => {
            running.add(task.task);
            if (onRunningTasksChange) {
                onRunningTasksChange(tasks.filter((runningTask) => running.has(runningTask.task)));
            }
            pending.delete(task.task);

            const agentName = task.assignee || AGENTS.ENGINEER;

            const taskHeader = `--- Task ${task.task}: ${task.description} (→ ${getAgentDisplayName(agentName)}) ---`;
            uiAPI.appendSystemMessage(taskHeader, false, "Harns");

            try {
                const sessionMessages = await agentSessionRunner({
                    agentName,
                    userRequest: buildTaskAssignmentRequest(planName, planBody, task, results),
                    uiAPI: createSilentUiApi(),
                });

                const outputText = extractAssistantOutput(sessionMessages);
                const completed = readLatestTaskCompletedOutcome(sessionMessages);

                if (Deno.env.get("DEBUG") === "1") {
                    const debugEntry = [
                        `=== TASK ${task.task} (${agentName}) AGENT RESPONSE ===`,
                        `=== Output text: ${outputText ? outputText.slice(0, 500) : "(empty)"} ===`,
                        `=== Total messages: ${sessionMessages.length} ===`,
                        `=== Assistant messages: ${
                            sessionMessages.filter((message) => "role" in message && message.role === "assistant")
                                .length
                        } ===`,
                        `===========================================`,
                        "",
                    ].join("\n");
                    try {
                        Deno.writeTextFileSync(join(Deno.cwd(), "debug.log"), debugEntry, { append: true });
                    } catch (_e) {
                        // Debug logging must never fail task execution.
                    }
                }

                const block = uiAPI.appendAgentMessageStart(
                    `${getAgentDisplayName(agentName)} (Task ${task.task} Output)`,
                );
                block.appendText(outputText || "_no output received_");

                if (!completed) {
                    const error = "Task ended without calling task_completed.";
                    uiAPI.appendSystemMessage(
                        `Task ${task.task} incomplete (${getAgentDisplayName(agentName)}): ${error}`,
                        false,
                        "Harns",
                    );
                    results.set(task.task, { status: "failed", error, messages: sessionMessages });

                    if (sessionManager?.appendCustomMessageEntry) {
                        sessionManager.appendCustomMessageEntry(
                            "task_result",
                            `Task ${task.task} (${getAgentDisplayName(agentName)}) INCOMPLETE: ${error}\n\n${
                                outputText || "(no output)"
                            }`,
                            true,
                            { taskId: task.task, agentName, status: "failed", error, output: outputText || "" },
                        );
                    }
                    return;
                }

                const display = buildTaskResultDisplay(task, agentName, outputText);
                results.set(task.task, {
                    status: "success",
                    messages: sessionMessages,
                    output: outputText || "",
                    display,
                });

                if (sessionManager?.appendCustomMessageEntry) {
                    sessionManager.appendCustomMessageEntry(
                        "task_result",
                        display,
                        true,
                        { taskId: task.task, agentName, status: "success", output: outputText || "" },
                    );
                }
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                uiAPI.appendSystemMessage(
                    `❌ Task ${task.task} failed (${getAgentDisplayName(agentName)}): ${error.message}`,
                    false,
                    "Harns",
                );
                results.set(task.task, { status: "failed", error: error.message });

                if (sessionManager?.appendCustomMessageEntry) {
                    sessionManager.appendCustomMessageEntry(
                        "task_result",
                        `Task ${task.task} (${getAgentDisplayName(agentName)}) FAILED: ${error.message}`,
                        true,
                        { taskId: task.task, agentName, status: "failed", error: error.message },
                    );
                }
            } finally {
                running.delete(task.task);
                if (onRunningTasksChange) {
                    onRunningTasksChange(tasks.filter((runningTask) => running.has(runningTask.task)));
                }
            }
        });

        if (launches.length > 0) {
            await Promise.race(launches);
        } else if (running.size > 0) {
            await new Promise((r) => setTimeout(r, 100));
            continue;
        } else if (pending.size === 0) {
            break;
        } else {
            tasks.filter((task) => pending.has(task.task)).forEach((task) => {
                results.set(task.task, { status: "blocked" });
            });
            break;
        }
    }

    const failedTasks = tasks
        .filter((task) => {
            const status = results.get(task.task)?.status;
            return status === "failed" || status === "blocked";
        })
        .map((task) => task.task);
    return { failedTasks, results };
}
