import { assertEquals } from "@std/assert";
import {
    countPackageResourcesForSource,
    getPackagePromptTemplatePaths,
    resolveInstalledPackagePromptResources,
} from "./package-resources.js";

Deno.test("resolveInstalledPackagePromptResources returns enabled package prompts only", async () => {
    /** @type {Array<unknown>} */
    const missingActions = [];
    const packageManager = {
        /** @param {(source: string) => Promise<"install" | "skip" | "error">} onMissing */
        async resolve(onMissing) {
            missingActions.push(await onMissing("npm:missing"));
            return {
                themes: [],
                extensions: [],
                skills: [{
                    path: "/pkg/skills/nope.md",
                    enabled: true,
                    metadata: { source: "npm:x", scope: "user", origin: "package" },
                }],
                prompts: [
                    {
                        path: "/pkg/prompts/explain.md",
                        enabled: true,
                        metadata: { source: "npm:x", scope: "user", origin: "package" },
                    },
                    {
                        path: "/pkg/prompts/off.md",
                        enabled: false,
                        metadata: { source: "npm:x", scope: "user", origin: "package" },
                    },
                    {
                        path: "/home/.wld/prompts/local.md",
                        enabled: true,
                        metadata: { source: "local", scope: "user", origin: "top-level" },
                    },
                ],
            };
        },
    };

    const resources = await resolveInstalledPackagePromptResources({
        packageManager: /** @type {any} */ (packageManager),
    });

    assertEquals(missingActions, ["skip"]);
    assertEquals(getPackagePromptTemplatePaths(resources), ["/pkg/prompts/explain.md"]);
});

Deno.test("countPackageResourcesForSource separates package resource types", () => {
    const resolved = {
        themes: [{
            path: "/pkg/themes/a.json",
            enabled: true,
            metadata: { source: "npm:x", scope: "user", origin: "package" },
        }],
        prompts: [
            {
                path: "/pkg/prompts/a.md",
                enabled: true,
                metadata: { source: "npm:x", scope: "user", origin: "package" },
            },
            {
                path: "/pkg/prompts/b.md",
                enabled: true,
                metadata: { source: "npm:other", scope: "user", origin: "package" },
            },
        ],
        extensions: [{
            path: "/pkg/index.js",
            enabled: true,
            metadata: { source: "npm:x", scope: "user", origin: "package" },
        }],
        skills: [{
            path: "/pkg/skills/a.md",
            enabled: true,
            metadata: { source: "npm:x", scope: "user", origin: "package" },
        }],
    };

    assertEquals(countPackageResourcesForSource(/** @type {any} */ (resolved), "npm:x"), {
        themes: 1,
        prompts: 1,
        extensions: 1,
        skills: 1,
    });
});
