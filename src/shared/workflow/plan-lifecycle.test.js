import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { buildPlanEventUpdates, isExecutablePlanStatus, recordPlanEvent } from "./plan-lifecycle.js";

Deno.test("buildPlanEventUpdates promotes approved plans to ready_for_work", () => {
    const updates = buildPlanEventUpdates("readiness_passed", "approved", {
        now: () => new Date("2026-01-02T03:04:05.000Z"),
    });

    assertEquals(updates.status, "ready_for_work");
    assertEquals(updates.updatedAt, "2026-01-02T03:04:05.000Z");
    assertEquals(updates.failureReason, null);
});

Deno.test("buildPlanEventUpdates captures execution baseline when work starts", () => {
    const updates = buildPlanEventUpdates("execution_started", "ready_for_work", {
        executionBaselineTree: "abc123",
        now: () => new Date("2026-01-02T03:04:05.000Z"),
    });

    assertEquals(updates.status, "in_progress");
    assertEquals(updates.executionBaselineTree, "abc123");
    assertEquals(updates.implementedAt, null);
});

Deno.test("buildPlanEventUpdates keeps implemented status when validation fails", () => {
    const updates = buildPlanEventUpdates("validation_failed", "implemented", {
        failureReason: "CI failed",
    });

    assertEquals(updates.status, "implemented");
    assertEquals(updates.failureReason, "CI failed");
});

Deno.test("buildPlanEventUpdates records continue recovery as ready_for_work", () => {
    const updates = buildPlanEventUpdates("recovery_continue", "failed", {
        now: () => new Date("2026-01-02T03:04:05.000Z"),
    });

    assertEquals(updates.status, "ready_for_work");
    assertEquals(updates.failureReason, null);
    assertEquals(updates.failedAt, null);
});

Deno.test("buildPlanEventUpdates only allows documented transitions", () => {
    assertThrows(
        () => buildPlanEventUpdates("execution_started", "approved"),
        Error,
        'execution_started cannot apply to status "approved"',
    );
});

Deno.test("isExecutablePlanStatus only accepts ready_for_work", () => {
    assertEquals(isExecutablePlanStatus("ready_for_work"), true);
    assertEquals(isExecutablePlanStatus("approved"), false);
    assertEquals(isExecutablePlanStatus("implemented"), false);
});

Deno.test("recordPlanEvent rejects invalid transitions before writing", async () => {
    await assertRejects(
        () =>
            recordPlanEvent({
                cwd: "/tmp",
                planName: "missing",
                event: "validation_passed",
                currentStatus: "approved",
            }),
        Error,
        'validation_passed cannot apply to status "approved"',
    );
});
