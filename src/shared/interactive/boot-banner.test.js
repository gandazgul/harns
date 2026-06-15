import { assertEquals } from "@std/assert";
import { renderBootBanner } from "./boot-banner.js";

Deno.test("renderBootBanner reports prompt templates, skills, theme, and blocked prompt warnings", async () => {
    /** @type {Array<{ text: string, isError: boolean, header: string }>} */
    const messages = [];

    await renderBootBanner({
        uiAPI: /** @type {any} */ ({
            appendSystemMessage: (
                /** @type {string} */ text,
                /** @type {boolean} */ isError = false,
                /** @type {string} */ header = "",
            ) => {
                messages.push({ text, isError, header });
            },
        }),
        invokablePromptTemplates: [
            { name: "review", source: "local" },
            { name: "release", source: "bundled" },
        ],
        blockedPromptTemplates: [
            { name: "help", source: "local" },
            { name: "sleep", source: "bundled" },
        ],
        chatPromptAgentName: "operator",
        __deps: {
            listSkills: () =>
                Promise.resolve([{
                    name: "diagnose",
                    description: "Debug",
                    path: "SKILL.md",
                    source: /** @type {"bundled"} */ ("bundled"),
                }]),
            listLoadedAgentMdFiles: () =>
                Promise.resolve([{ path: "/repo/HARNS.md", source: /** @type {"local"} */ ("local") }]),
            getSettingsManager: () => ({ getTheme: () => "catppuccin-mocha" }),
        },
    });

    assertEquals(messages[0].header, "Loaded Prompt Templates (2):");
    assertEquals(messages[0].text.includes("/review, /release"), true);
    assertEquals(messages[0].text.includes("operator"), true);
    assertEquals(messages.some((message) => message.header.startsWith("Loaded Skills")), true);
    assertEquals(messages.some((message) => message.header === "Loaded Theme:"), true);
    assertEquals(
        messages.some((message) =>
            message.isError && message.text.includes("./.hns/prompts/help.md command can't be invoked")
        ),
        true,
    );
    assertEquals(messages.some((message) => message.text.includes("sleep.md command can't be invoked")), false);
});

Deno.test("renderBootBanner reports no prompt templates when none are invokable", async () => {
    /** @type {Array<{ text: string, header: string }>} */
    const messages = [];

    await renderBootBanner({
        uiAPI: /** @type {any} */ ({
            appendSystemMessage: (
                /** @type {string} */ text,
                _isError = false,
                /** @type {string} */ header = "",
            ) => {
                messages.push({ text, header });
            },
        }),
        invokablePromptTemplates: [],
        blockedPromptTemplates: [],
        chatPromptAgentName: "operator",
        __deps: {
            listSkills: () => Promise.resolve([]),
            listLoadedAgentMdFiles: () => Promise.resolve([]),
            getSettingsManager: () => ({ getTheme: () => undefined }),
        },
    });

    assertEquals(messages[0], { text: "none", header: "Loaded Prompt Templates:" });
});
