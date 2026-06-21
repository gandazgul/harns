import { assertEquals } from "@std/assert";
import {
    buildRouterGoldenReport,
    normalizeGoldenRow,
    runRouterForGoldenRequest,
    runRouterGoldenSet,
} from "./run-router-golden-set.js";

Deno.test("normalizeGoldenRow fills stable defaults and router metrics", () => {
    assertEquals(
        normalizeGoldenRow({
            requestText: "fix it",
            routerDecision: "QUICK_FIX",
            humanJudgement: "FEATURE",
        }, 0),
        {
            decisionId: "golden-0001",
            timestamp: "",
            attribution: "golden_fixture",
            requestText: "fix it",
            routerDecision: "QUICK_FIX",
            humanJudgement: "FEATURE",
            humanNotes: "",
            routerSummary: "",
            routerAffectedPaths: "",
            routerAgreesWithHuman: "FALSE",
            routerCorrection: "QUICK_FIX->FEATURE",
            routerDistanceFromHuman: 1,
            routerDisagreementKind: "scope_underestimated",
        },
    );
});

Deno.test("runRouterForGoldenRequest returns latest triage_report outcome", async () => {
    const triage = await runRouterForGoldenRequest("where is router?", {
        runAgentSession: () =>
            Promise.resolve(
                /** @type {any} */ ([{
                    role: "toolResult",
                    toolName: "triage_report",
                    details: {
                        routingIntent: "INQUIRY",
                        complexity: "LOW",
                        summary: "answer",
                        affectedPaths: [],
                    },
                }]),
            ),
    });

    assertEquals(triage.routingIntent, "INQUIRY");
});

Deno.test("runRouterGoldenSet updates labelled rows and honors limit", async () => {
    const rows = await runRouterGoldenSet([
        { decisionId: "d1", requestText: "hi", humanJudgement: "INQUIRY" },
        { decisionId: "d2", requestText: "fix it", humanJudgement: "QUICK_FIX" },
    ], {
        limit: 1,
        runAgentSession: () =>
            Promise.resolve(
                /** @type {any} */ ([{
                    role: "toolResult",
                    toolName: "triage_report",
                    details: {
                        routingIntent: "INQUIRY",
                        complexity: "LOW",
                        summary: "greeting",
                        affectedPaths: ["README.md"],
                    },
                }]),
            ),
    });

    assertEquals(rows[0].routerDecision, "INQUIRY");
    assertEquals(rows[0].routerSummary, "greeting");
    assertEquals(rows[0].routerAffectedPaths, "README.md");
    assertEquals(rows[0].routerAgreesWithHuman, "TRUE");
    assertEquals(rows[1].routerDecision, "");
});

Deno.test("runRouterGoldenSet records row errors and continues", async () => {
    const rows = await runRouterGoldenSet([
        { decisionId: "d1", requestText: "hi", humanJudgement: "INQUIRY" },
    ], {
        runAgentSession: () => {
            throw new Error("model failed");
        },
    });

    assertEquals(rows[0].routerDecision, "");
    assertEquals(rows[0].routerSummary, "ERROR: model failed");
    assertEquals(rows[0].routerAgreesWithHuman, "");
});

Deno.test("buildRouterGoldenReport scores router decisions", () => {
    assertEquals(
        buildRouterGoldenReport([
            { humanJudgement: "INQUIRY", routerDecision: "INQUIRY" },
            { humanJudgement: "FEATURE", routerDecision: "QUICK_FIX" },
            { humanJudgement: "", routerDecision: "PROJECT" },
        ]),
        {
            labelledRows: 2,
            unlabelledRows: 1,
            router: {
                total: 2,
                agreementCount: 1,
                agreementRate: 0.5,
                meanDistance: 0.5,
                invalidRows: 0,
                unscoredRows: 0,
                corrections: { "QUICK_FIX->FEATURE": 1 },
            },
        },
    );
});
