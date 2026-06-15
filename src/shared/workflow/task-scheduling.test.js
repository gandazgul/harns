import { assertEquals, assertThrows } from "@std/assert";
import { parseTaskDependencies, parseTaskWriteScope, validateProjectTasks } from "./task-scheduling.js";

Deno.test("parseTaskDependencies accepts none and comma-separated numeric ids", () => {
    assertEquals(parseTaskDependencies("none"), []);
    assertEquals(parseTaskDependencies("1, 2, 10"), [1, 2, 10]);
});

Deno.test("parseTaskDependencies rejects non-numeric dependencies", () => {
    assertThrows(
        () => parseTaskDependencies("1, alpha"),
        Error,
        'Task dependency "alpha" is not a numeric task ID.',
    );
});

Deno.test("parseTaskWriteScope normalizes multiple path separators and code ticks", () => {
    assertEquals(parseTaskWriteScope("`./src/foo/`; docs/bar\nREADME.md"), {
        broad: false,
        paths: ["src/foo", "docs/bar", "readme.md"],
    });
});

Deno.test("validateProjectTasks rejects duplicate ids and unknown dependencies", () => {
    assertThrows(
        () =>
            validateProjectTasks([
                { task: 1, assignee: "engineer", dependencies: "none", description: "Implement slice" },
                { task: 1, assignee: "tester", dependencies: "1", description: "Integration Point: run validation" },
            ]),
        Error,
        "Duplicate task ID 1.",
    );

    assertThrows(
        () =>
            validateProjectTasks([
                { task: 1, assignee: "engineer", dependencies: "99", description: "Implement slice" },
                { task: 2, assignee: "tester", dependencies: "1", description: "Integration Point: run validation" },
            ]),
        Error,
        "depends on unknown task 99",
    );
});
