import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { runModelsCommand } from "../../cmd/models/index.ts";
import { withRuntimeCommandFixture } from "../../cmd/testing/runtime-command-fixture.ts";
import { assertModelExecutionBackendSupported } from "../models/model-execution.ts";
import { getModelRegistry } from "../models/model-registry.ts";
import { getSettingsManager } from "../settings.js";
import { createSessionRuntime } from "./session-runtime.js";

const FIXTURE_MODEL = "runtime-command-fixture/fixture-model";

Deno.test("configured Agy CLI model is registered and accepted by typed execution backend dispatch", () => {
    const model = getModelRegistry().find("agy-cli", `selection-${crypto.randomUUID()}`);
    assert(model);
    assertModelExecutionBackendSupported(model);
});

Deno.test("explicit Agy CLI selection persists and updates the active runtime Session model", async () => {
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
                model: modelId,
                provider: "agy-cli",
            });
            assertEquals(getSettingsManager(projectRoot).getDefaultProvider(), "agy-cli");
            assertEquals(getSettingsManager(projectRoot).getDefaultModel(), modelId);
            assertStringIncludes(messages.at(-1) || "", `Switched model to agy-cli/${modelId}`);
        } finally {
            runtime.closeAllSessions();
        }
    });
});
