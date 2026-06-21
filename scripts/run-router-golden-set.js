/**
 * @module scripts/run-router-golden-set
 *
 * Run the real Router against golden judgement rows and compare its
 * triage_report decision to humanJudgement.
 */

import { parseArgs } from "@std/cli/parse-args";
import { AGENTS } from "../src/constants.js";
import { runAgentSession as runAgentSessionFn } from "../src/shared/session/session.js";
import { readLatestTriageOutcome as readLatestTriageOutcomeFn } from "../src/shared/workflow/orchestrator.js";
import {
    parseCsv,
    ROUTER_JUDGEMENT_COLUMNS,
    scoreAgainstHuman,
    toCsv,
    withRouterJudgementMetrics,
} from "./router-eval-utils.js";

const DEFAULT_CSV = "router-judgements.csv";

/**
 * @returns {import('../src/shared/workflow/workflow.js').UiAPI}
 */
function createQuietUiAPI() {
    return /** @type {import('../src/shared/workflow/workflow.js').UiAPI} */ (/** @type {unknown} */ ({
        appendSystemMessage: () => {},
        appendAgentMessageStart: () => ({ appendText: () => {} }),
        isOutputSuppressed: () => true,
        promptSelect: () => Promise.resolve(null),
        promptText: () => Promise.resolve(null),
        requestRender: () => {},
        showModelSelector: () => Promise.resolve(null),
    }));
}

/**
 * @param {Record<string, string>} row
 * @param {number} index
 * @returns {string}
 */
function getDecisionId(row, index) {
    return row.decisionId || `golden-${String(index + 1).padStart(4, "0")}`;
}

/**
 * @param {string | undefined} value
 * @returns {number | undefined}
 */
function parsePositiveInt(value) {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * @param {Record<string, string>} row
 * @param {number} index
 * @returns {Record<string, unknown>}
 */
export function normalizeGoldenRow(row, index) {
    return withRouterJudgementMetrics({
        decisionId: getDecisionId(row, index),
        timestamp: row.timestamp || "",
        attribution: row.attribution || "golden_fixture",
        requestText: row.requestText || "",
        routerDecision: row.routerDecision || "",
        humanJudgement: row.humanJudgement || "",
        humanNotes: row.humanNotes || "",
        routerSummary: row.routerSummary || "",
        routerAffectedPaths: row.routerAffectedPaths || "",
    });
}

/**
 * @param {Record<string, string>} row
 * @returns {boolean}
 */
function shouldRunRow(row) {
    return Boolean(row.requestText?.trim() && row.humanJudgement?.trim());
}

/**
 * @param {string} requestText
 * @param {{
 *   cwd?: string,
 *   modelOverride?: string,
 *   uiAPI?: import('../src/shared/workflow/workflow.js').UiAPI,
 *   runAgentSession?: typeof runAgentSessionFn,
 *   readLatestTriageOutcome?: typeof readLatestTriageOutcomeFn,
 * }} [options]
 * @returns {Promise<import('../src/shared/workflow/orchestrator.js').TriageOutcome>}
 */
export async function runRouterForGoldenRequest(requestText, options = {}) {
    const runAgentSession = options.runAgentSession || runAgentSessionFn;
    const readLatestTriageOutcome = options.readLatestTriageOutcome || readLatestTriageOutcomeFn;
    const messages = await runAgentSession({
        agentName: AGENTS.ROUTER,
        userRequest: requestText,
        images: [],
        uiAPI: options.uiAPI || createQuietUiAPI(),
        modelOverride: options.modelOverride,
        cwd: options.cwd,
        allowReturnToRouter: false,
    });
    const triage = readLatestTriageOutcome(messages);
    if (!triage) throw new Error("Router did not call triage_report.");
    return triage;
}

/**
 * @param {Array<Record<string, string>>} rows
 * @param {{
 *   limit?: number,
 *   cwd?: string,
 *   modelOverride?: string,
 *   runAgentSession?: typeof runAgentSessionFn,
 *   readLatestTriageOutcome?: typeof readLatestTriageOutcomeFn,
 *   onProgress?: (message: string) => void,
 *   onRowComplete?: (rows: Array<Record<string, unknown>>) => Promise<void> | void,
 * }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function runRouterGoldenSet(rows, options = {}) {
    const normalized = rows.map(normalizeGoldenRow);
    const runnableIndexes = normalized
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => shouldRunRow(/** @type {Record<string, string>} */ (row)));
    const selected = options.limit ? runnableIndexes.slice(0, options.limit) : runnableIndexes;

    for (let selectedIndex = 0; selectedIndex < selected.length; selectedIndex++) {
        const { row, index } = selected[selectedIndex];
        try {
            const triage = await runRouterForGoldenRequest(String(row.requestText || ""), {
                cwd: options.cwd,
                modelOverride: options.modelOverride,
                runAgentSession: options.runAgentSession,
                readLatestTriageOutcome: options.readLatestTriageOutcome,
            });
            normalized[index] = withRouterJudgementMetrics({
                ...row,
                routerDecision: triage.routingIntent,
                routerSummary: triage.summary || "",
                routerAffectedPaths: (triage.affectedPaths || []).join("; "),
            });
        } catch (error) {
            normalized[index] = withRouterJudgementMetrics({
                ...row,
                routerDecision: "",
                routerSummary: `ERROR: ${error instanceof Error ? error.message : String(error)}`,
                routerAffectedPaths: "",
            });
        }
        await options.onRowComplete?.(normalized);
        options.onProgress?.(
            `Routed ${selectedIndex + 1}/${selected.length}: ${normalized[index].decisionId || "(unknown decision)"}`,
        );
    }

    return normalized;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Record<string, unknown>}
 */
export function buildRouterGoldenReport(rows) {
    const labelledRows = rows.filter((row) => String(row.humanJudgement || "").trim()).length;
    const router = scoreAgainstHuman(
        rows.map((row) => /** @type {Record<string, string>} */ (row)),
        "routerDecision",
    );
    return {
        labelledRows,
        unlabelledRows: rows.length - labelledRows,
        router,
    };
}

/**
 * @param {string[]} argv
 */
export async function main(argv) {
    const args = parseArgs(argv, {
        string: ["csv", "out", "limit", "model", "cwd"],
        boolean: ["help"],
        alias: { h: "help", o: "out", m: "model" },
    });

    if (args.help) {
        console.log([
            "Usage: deno run -A scripts/run-router-golden-set.js [options]",
            "",
            "Runs the real Router against labelled router-judgements.csv rows.",
            "",
            "Options:",
            `  --csv <path>          Golden CSV input (default: ${DEFAULT_CSV})`,
            "  --out, -o <path>     CSV output (default: same as --csv)",
            "  --limit <n>          Run only the first n labelled rows",
            "  --model, -m <ref>    Override Router model, e.g. provider/model",
            "  --cwd <path>         Cwd for Router discovery tools",
        ].join("\n"));
        return;
    }

    const csvPath = args.csv || DEFAULT_CSV;
    const outputPath = args.out || csvPath;
    const rows = parseCsv(await Deno.readTextFile(csvPath));
    const resultRows = await runRouterGoldenSet(rows, {
        limit: parsePositiveInt(args.limit),
        cwd: args.cwd,
        modelOverride: args.model,
        onRowComplete: async (checkpointRows) => {
            await Deno.writeTextFile(outputPath, toCsv(ROUTER_JUDGEMENT_COLUMNS, checkpointRows));
        },
        onProgress: (message) => console.error(message),
    });

    await Deno.writeTextFile(outputPath, toCsv(ROUTER_JUDGEMENT_COLUMNS, resultRows));
    console.log(JSON.stringify(buildRouterGoldenReport(resultRows), null, 2));
}

if (import.meta.main) {
    await main(Deno.args);
}
