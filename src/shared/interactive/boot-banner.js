/**
 * @module shared/interactive/boot-banner
 *
 * Boot summary printed at the top of an interactive session: the loaded
 * prompt templates, available skills, and warnings for any prompt template
 * that would shadow a built-in slash command.
 */

import { listSkills } from "../session/session.js";

/**
 * @typedef {{ name: string, source: "local" | "home" | "bundled" }} PromptTemplate
 */

/**
 * @param {PromptTemplate} template
 */
function toUserFacingPromptPath(template) {
    if (template.source === "local") return `./.hns/prompts/${template.name}.md`;
    return `~/.hns/prompts/${template.name}.md`;
}

/**
 * @param {{
 *   uiAPI: import('../ui/types.js').UiAPI,
 *   invokablePromptTemplates: PromptTemplate[],
 *   blockedPromptTemplates: PromptTemplate[],
 *   chatPromptAgentName: string,
 * }} deps
 */
export async function renderBootBanner({
    uiAPI,
    invokablePromptTemplates,
    blockedPromptTemplates,
    chatPromptAgentName,
}) {
    const peachStyle = { headingColor: "mdHeading" };

    if (invokablePromptTemplates.length > 0) {
        const names = invokablePromptTemplates.map((template) => `/${template.name}`).join(", ");
        uiAPI.appendSystemMessage(
            `${names} (slash commands execute via ${chatPromptAgentName})`,
            false,
            `Loaded prompt templates (${invokablePromptTemplates.length}):`,
            peachStyle,
        );
    } else {
        uiAPI.appendSystemMessage("none", false, "Loaded prompt templates:", peachStyle);
    }

    const skills = await listSkills();
    if (skills && skills.length > 0) {
        const skillNames = skills.map((s) => s.name).join(", ");
        uiAPI.appendSystemMessage(skillNames, false, `Loaded skills (${skills.length}):`, peachStyle);
    } else {
        uiAPI.appendSystemMessage("none", false, "Loaded skills:", peachStyle);
    }

    for (const blocked of blockedPromptTemplates) {
        if (blocked.source !== "local" && blocked.source !== "home") continue;
        const userPath = toUserFacingPromptPath(blocked);
        uiAPI.appendSystemMessage(
            `Warning: ${userPath} command can't be invoked because it would override Harns built-in commands. Please rename it.`,
            true,
        );
    }
}
