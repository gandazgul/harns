import { assertEquals, assertStringIncludes } from "@std/assert";
import { savePlan } from "../../plan-store.js";
import { PLAN_UI_TOKEN_HEADER } from "../../constants.js";
import { buildBoardGroups, loadBoard, loadPlanSummaries, serializePlanSummary } from "./server/plan-adapter.js";
import { createWorkspaceApp, hasWorkspaceToken } from "./server.js";

Deno.test("workspace token accepts query or header and rejects missing tokens", () => {
    assertEquals(hasWorkspaceToken(new Request("http://localhost/?token=abc"), "abc"), true);
    assertEquals(
        hasWorkspaceToken(new Request("http://localhost/", { headers: { [PLAN_UI_TOKEN_HEADER]: "abc" } }), "abc"),
        true,
    );
    assertEquals(hasWorkspaceToken(new Request("http://localhost/"), "abc"), false);
});

Deno.test("serializePlanSummary omits absolute paths and surfaces hierarchy/dependency metadata", () => {
    const summary = serializePlanSummary({
        planId: "p1",
        planName: "epic/child",
        relativePath: "plans/epic/child.md",
        path: "/tmp/project/plans/epic/child.md",
        attrs: {
            status: "draft",
            classification: "FEATURE",
            parentPlan: "epic",
            summary: "Child",
            dependencies: ["sibling-id"],
        },
    });
    assertEquals(summary.relativePath, "plans/epic/child.md");
    assertEquals(Object.hasOwn(summary, "path"), false);
    assertEquals(summary.isChild, true);
    assertEquals(summary.hierarchyRole, "child");
    assertEquals(summary.dependsOn, ["sibling-id"]);
    assertEquals(summary.dependencies, ["sibling-id"]);
});

Deno.test("buildBoardGroups separates active closed and on-hold Plans", () => {
    const plans = [
        { name: "active", planName: "active", planId: "a", status: "draft", attrs: {}, classification: "FEATURE" },
        {
            name: "closed",
            planName: "closed",
            planId: "c",
            status: "closed_without_verification",
            attrs: {},
            classification: "FEATURE",
        },
        { name: "hold", planName: "hold", planId: "h", status: "on_hold", attrs: {}, classification: "FEATURE" },
    ];
    const groups = /** @type {any} */ (buildBoardGroups(/** @type {any} */ (plans)));
    assertEquals(groups.active.standalone.map(/** @param {any} plan */ (plan) => plan.planName), ["active"]);
    assertEquals(groups.closed.standalone.map(/** @param {any} plan */ (plan) => plan.planName), ["closed"]);
    assertEquals(groups.onHold.standalone.map(/** @param {any} plan */ (plan) => plan.planName), ["hold"]);
});

Deno.test("buildBoardGroups keeps children with existing Epics out of orphan lanes across status filters", () => {
    const plans = [
        {
            name: "epic",
            planName: "epic",
            planId: "epic-id",
            status: "verified",
            attrs: { classification: "PROJECT", type: "epic" },
            classification: "PROJECT",
            type: "epic",
            isEpic: true,
            isChild: false,
        },
        {
            name: "epic/child",
            planName: "epic/child",
            planId: "child-id",
            status: "draft",
            attrs: { classification: "FEATURE", parentPlan: "epic" },
            classification: "FEATURE",
            parentPlan: "epic",
            isEpic: false,
            isChild: true,
        },
    ];
    const groups = /** @type {any} */ (buildBoardGroups(/** @type {any} */ (plans)));
    assertEquals(groups.active.orphanChildren.length, 0);
    assertEquals(groups.active.epics.map(/** @param {any} epic */ (epic) => epic.planName), ["epic"]);
    assertEquals(groups.active.epics[0].children.map(/** @param {any} child */ (child) => child.planName), [
        "epic/child",
    ]);
});

Deno.test("loadPlanSummaries marks top-level, Epic, child, and orphan-child hierarchy roles", async () => {
    const cwd = await Deno.makeTempDir();
    try {
        await savePlan(cwd, "top", "# Top", { planId: "top-id", classification: "FEATURE" });
        await savePlan(cwd, "epic", "# Epic", {
            planId: "epic-id",
            classification: "PROJECT",
            type: "epic",
        });
        await savePlan(cwd, "epic/child", "# Child", {
            planId: "child-id",
            classification: "FEATURE",
            parentPlan: "epic",
        });
        await savePlan(cwd, "missing/child", "# Orphan", {
            planId: "orphan-id",
            classification: "FEATURE",
            parentPlan: "missing",
        });
        const byId = new Map((await loadPlanSummaries(cwd)).map((plan) => [plan.planId, plan.hierarchyRole]));
        assertEquals(byId.get("top-id"), "top-level");
        assertEquals(byId.get("epic-id"), "epic");
        assertEquals(byId.get("child-id"), "child");
        assertEquals(byId.get("orphan-id"), "orphan-child");
    } finally {
        await Deno.remove(cwd, { recursive: true });
    }
});

Deno.test("Fresh Workspace rejects missing token and SSR-renders board cards", async () => {
    const cwd = await Deno.makeTempDir();
    try {
        await savePlan(cwd, "workspace-card", "# Workspace Card\n\nBody", {
            planId: "workspace-card-id",
            status: "draft",
            classification: "FEATURE",
            summary: "SSR card",
        });
        const app = createWorkspaceApp({ cwd, token: "secret" }).handler();
        const rejected = await app(new Request("http://localhost/"));
        assertEquals(rejected.status, 401);

        const accepted = await app(new Request("http://localhost/?token=secret"));
        assertEquals(accepted.status, 200);
        const html = await accepted.text();
        assertStringIncludes(html, "workspace-card");
        assertStringIncludes(html, "SSR card");
    } finally {
        await Deno.remove(cwd, { recursive: true });
    }
});

Deno.test("Workspace API and detail route return read-only Plan content", async () => {
    const cwd = await Deno.makeTempDir();
    try {
        await savePlan(cwd, "detail", "# Detail\n\nReadable body", {
            planId: "detail-id",
            status: "implemented",
            classification: "FEATURE",
            summary: "Detail summary",
        });
        const board = await loadBoard(cwd);
        assertEquals(board.plans.length, 1);

        const app = createWorkspaceApp({ cwd, token: "secret" }).handler();
        const api = await app(
            new Request("http://localhost/api/plans/detail-id", {
                headers: { [PLAN_UI_TOKEN_HEADER]: "secret" },
            }),
        );
        assertEquals(api.status, 200);
        assertEquals((await api.json()).plan.readOnly, true);

        const detail = await app(new Request("http://localhost/plans/detail-id?token=secret"));
        const html = await detail.text();
        assertStringIncludes(html, "Readable body");
        assertStringIncludes(html, "read-only");
    } finally {
        await Deno.remove(cwd, { recursive: true });
    }
});
