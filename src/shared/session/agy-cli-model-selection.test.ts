import { assert, assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { runModelsCommand } from "../../cmd/models/index.ts";
import { withRuntimeCommandFixture } from "../../cmd/testing/runtime-command-fixture.ts";
import {
    assertModelExecutionBackendSupported,
    UnsupportedModelExecutionBackendError,
} from "../models/model-execution.ts";
import { getModelRegistry } from "../models/model-registry.ts";
import { getSettingsManager } from "../settings.js";
import { createSessionRuntime } from "./session-runtime.js";

const FIXTURE_MODEL = "runtime-command-fixture/fixture-model";

Deno.test("configured Agy CLI model is registered but rejected by typed execution backend dispatch", () => {
    const model = getModelRegistry().find("agy-cli", `selection-${crypto.randomUUID()}`);
    assert(model);
    const error = assertThrows(
        () => assertModelExecutionBackendSupported(model),
        UnsupportedModelExecutionBackendError,
    );
    assertEquals(error.executionBackend, "agy-cli");
});

Deno.test("explicit Agy CLI selection persists a deferred default and leaves the runtime Session unchanged", async () => {
    await withRuntimeCommandFixture("runwield-agy-cli-selection-", async ({ projectRoot }) => {
        const runtime = createSessionRuntime();
        const messages: string[] = [];
        const modelId = `session-${crypto.randomUUID()}`;
        try {
            const { sessionId } = await runtime.createInteractiveSession({ cwd: projectRoot, mode: "new" });
            await runModelsCommand([FIXTURE_MODEL], {
                uiAPI: {
                    appendSystemMessage: (message) => messages.push(message),
                    promptSelect: () => Promise.resolve(null),
                },
                sessionId,
                sessionRuntime: runtime,
            });
            assertEquals(runtime.getSessionSnapshot(sessionId)?.activeModel, {
                model: "fixture-model",
                provider: "runtime-command-fixture",
            });
            const firstTurn = await runtime.promptUserTurn(sessionId, { initialRequest: "Prime the fixture model" });
            assertEquals(firstTurn.ok, true);
            messages.length = 0;

            await runModelsCommand([`agy-cli/${modelId}`], {
                uiAPI: {
                    appendSystemMessage: (message) => messages.push(message),
                    promptSelect: () => Promise.resolve(null),
                },
                sessionId,
                sessionRuntime: runtime,
            });

            assertEquals(runtime.getSessionSnapshot(sessionId)?.activeModel, {
                model: "fixture-model",
                provider: "runtime-command-fixture",
            });
            assertEquals(getSettingsManager(projectRoot).getDefaultProvider(), "agy-cli");
            assertEquals(getSettingsManager(projectRoot).getDefaultModel(), modelId);
            assertStringIncludes(messages.at(-1) || "", `Saved agy-cli/${modelId} for later.`);
            assertStringIncludes(messages.at(-1) || "", "The current Session was not switched.");
        } finally {
            runtime.closeAllSessions();
        }
    });
});
