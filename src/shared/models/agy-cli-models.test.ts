import { assert, assertEquals, assertObjectMatch, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { assertModelExecutionBackendSupported, UnsupportedModelExecutionBackendError } from "./model-execution.ts";
import { RunWieldCredentialStore, RunWieldModelRegistry } from "./model-registry.ts";
import { parseProviderModel, resolveTemplateModel } from "./model-validation.ts";

async function makeRegistry(): Promise<{ registry: RunWieldModelRegistry; tempDir: string }> {
    const tempDir = await Deno.makeTempDir({ prefix: "runwield-agy-cli-models-" });
    return {
        tempDir,
        registry: new RunWieldModelRegistry({
            configDir: tempDir,
            credentialStore: new RunWieldCredentialStore(join(tempDir, "auth.json")),
        }),
    };
}

function generatedModelIds(): string[] {
    return [
        `model-${crypto.randomUUID()}`,
        `vendor/path/${crypto.randomUUID()}`,
        "x",
        `short-${"x".repeat(58)}`,
        `long-${"x".repeat(252)}`,
        `very-long-${"x".repeat(4087)}`,
    ];
}

Deno.test("Agy CLI lookup preserves every parser-accepted non-empty selector without catalog or length rules", async () => {
    const { registry, tempDir } = await makeRegistry();
    try {
        for (const modelId of generatedModelIds()) {
            const reference = `agy-cli/${modelId}`;
            const parsed = parseProviderModel(reference);
            if (!parsed.ok) throw new Error(`Fixture reference was rejected by the shared parser: ${reference}`);

            const model = registry.find(parsed.provider, parsed.id);
            assert(model);
            assertObjectMatch(model, {
                provider: "agy-cli",
                id: modelId,
                executionBackend: "agy-cli",
                authenticationKind: "external-cli",
                healthCheck: "execution-preflight",
                contextWindow: 128000,
                maxTokens: 16384,
                input: ["text"],
            });
            assertEquals(registry.isSelectable(model), true);
            assertEquals(registry.hasConfiguredAuth(model), false);
            assertEquals(registry.getProviderAuthStatus("agy-cli"), { configured: false });
            assertEquals(await registry.getProviderAuth("agy-cli"), undefined);
            assertEquals(await registry.getApiKeyForProvider("agy-cli"), undefined);
            assertEquals(await registry.getApiKeyAndHeaders(model), {
                ok: false,
                error: "No API auth for external CLI provider agy-cli",
            });
            assertEquals(registry.isUsingOAuth(model), false);
            assertEquals(resolveTemplateModel(reference, registry), { ok: true, provider: "agy-cli", id: modelId });

            const error = assertThrows(
                () => assertModelExecutionBackendSupported(model),
                UnsupportedModelExecutionBackendError,
            );
            assertEquals(error.executionBackend, "agy-cli");
            assertEquals(error.provider, "agy-cli");
            assertEquals(error.model, modelId);
        }

        assertEquals(registry.getAll().some((model) => model.provider === "agy-cli"), false);
        assertEquals(registry.getSelectable().some((model) => model.provider === "agy-cli"), false);
        assertEquals(registry.getAvailable().some((model) => model.provider === "agy-cli"), false);
    } finally {
        await Deno.remove(tempDir, { recursive: true });
    }
});

Deno.test("Agy CLI rejects empty selectors without weakening unknown provider failures", async () => {
    const { registry, tempDir } = await makeRegistry();
    try {
        assertEquals(registry.find("agy-cli", "   "), undefined);
        assertEquals(resolveTemplateModel("agy-cli/", registry), { ok: false });
        assertEquals(resolveTemplateModel("missing-provider/future-model", registry), { ok: false });
    } finally {
        await Deno.remove(tempDir, { recursive: true });
    }
});

Deno.test("Agy CLI remains outside API auth even when files contain misleading provider entries", async () => {
    const { registry, tempDir } = await makeRegistry();
    try {
        const store = new RunWieldCredentialStore(join(tempDir, "auth.json"));
        await Deno.writeTextFile(
            join(tempDir, "auth.json"),
            JSON.stringify({
                "agy-cli": { type: "api_key", key: "fake" },
                "claude-cli": { type: "api_key", key: "also-fake" },
                openai: { type: "api_key", key: "real" },
            }),
        );
        await Deno.writeTextFile(
            join(tempDir, "models.json"),
            JSON.stringify({
                providers: {
                    "agy-cli": {
                        name: "Wrong API Provider",
                        apiKey: "fake",
                        models: [{ id: "configured-only", name: "Wrong" }],
                    },
                    "claude-cli": {
                        apiKey: "also-fake",
                        models: [{ id: "sonnet", name: "Wrong" }],
                    },
                    local: {
                        baseUrl: "https://local.example.test/v1",
                        api: "openai-completions",
                        apiKey: "real",
                        models: [{ id: "configured" }],
                    },
                },
            }),
        );

        const model = registry.find("agy-cli", "configured-only");
        assert(model);
        assertObjectMatch(model, {
            provider: "agy-cli",
            id: "configured-only",
            name: "Antigravity CLI configured-only",
            executionBackend: "agy-cli",
            authenticationKind: "external-cli",
            healthCheck: "execution-preflight",
        });
        assertEquals(await store.read("agy-cli"), undefined);
        assertEquals(await store.read("claude-cli"), undefined);
        assertEquals(await store.list(), [{ providerId: "openai", type: "api_key" }]);
        assertEquals(registry.getProvider("agy-cli"), undefined);
        assertEquals(registry.getRegisteredProviderConfig("agy-cli"), undefined);
        assertEquals(registry.getRegisteredProviderIds(), ["local"]);
        assertEquals(registry.getAll().some((entry) => entry.provider === "agy-cli"), false);
        assertEquals(registry.getConfiguredModels().some((entry) => entry.provider === "agy-cli"), false);
        assertEquals(registry.hasConfiguredAuth(model), false);
        assertEquals(await registry.getApiKeyForProvider("agy-cli"), undefined);
        assertEquals(registry.find("local", "configured")?.provider, "local");
    } finally {
        await Deno.remove(tempDir, { recursive: true });
    }
});

Deno.test("unknown execution backends still receive the typed support rejection", () => {
    const baseModel = {
        provider: "fixture",
        id: "model",
        name: "Fixture Model",
        api: "openai-completions" as const,
        baseUrl: "",
        reasoning: false,
        input: ["text" as const],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
    };

    const error = assertThrows(
        () =>
            assertModelExecutionBackendSupported({
                ...baseModel,
                // @ts-expect-error This intentionally exercises the defensive runtime guard for invalid persisted data.
                executionBackend: "future",
            }),
        UnsupportedModelExecutionBackendError,
    );
    assertEquals(error.executionBackend, "future");
});
