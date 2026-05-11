---
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Add skill:{name} slash command support. Skills already exist in src/skills/ with SKILL.md files, and listSkills() already loads them. Pi handles skill invocation by wrapping the markdown content in a &lt;skill&gt; XML block and sending it as a regular user message to the LLM (which then follows the skill's instructions). The model sees it as conversation context, not a special tool call. Implementation needs: (1) populate autocomplete with skill:{name} commands using existing listSkills(), (2) add skill expansion in slash-dispatch similar to Pi's _expandSkillCommand that reads the SKILL.md file and formats it as a &lt;skill&gt; block, (3) send the expanded skill content as a user message to the active agent."
affectedPaths:
  - "src/shared/interactive/slash-dispatch.js"
  - "src/shared/interactive/chat-session.js"
  - "src/shared/session/session.js"
  - "src/skills/"
createdAt: "2026-05-11T00:00:00.000Z"
updatedAt: "2026-05-11T13:28:07.643Z"
status: "in_review"
origin: "internal"
---
# Add /skill:{name} Slash Command Support

## Context

Harns already has skills in `src/skills/` (diagnose, grill-with-docs, ketch, prototype, improve-codebase-architecture, write-a-skill) with `SKILL.md` files, and `listSkills()` already loads them for the system prompt. The request is to expose them as interactive `/skill:{name}` slash commands with autocomplete — matching Pi's convention (Pi expands `/skill:diagnose` to a `<skill>` XML block sent as a user message to the LLM).

## Objective

1. Autocomplete shows skills as `skill:{name}` alongside existing built-in commands and prompt templates.
2. When user submits `/skill:{name}`, read its `SKILL.md`, strip frontmatter, wrap in `<skill name="..." location="...">...</skill>` XML, and send as a user message to the active agent via `runAgentSession()` — exactly like Pi does.
3. Optional trailing text after the skill name is appended as additional instructions.

## Approach

**Step 1 — Autocomplete**: In `chat-session.js`, after building the prompt template autocomplete list, add skills from `listSkills()` as `skill:{name}` entries.

**Step 2 — Skill dispatch**: In `slash-dispatch.js`, detect `/skill:` prefix in `handleSlashCommand()`, read the SKILL.md file, format as `<skill>` XML block, and send as a user message via `runAgentSession()`.

**Step 3 — Expansion logic**: Modeled after Pi's `_expandSkillCommand()` in `agent-session.ts`:
```
<skill name="diagnose" location="/path/to/SKILL.md">
References are relative to /path/to/skills/diagnose.

[stripped markdown body]
</skill>

[optional user arguments]
```

## Files to Modify

- `src/shared/interactive/chat-session.js` — add skills to `CombinedAutocompleteProvider` (~line 400), pass skills list to `handleSlashCommand` (~line 570)
- `src/shared/interactive/slash-dispatch.js` — add `SkillMeta` type, add `skill:` prefix check in `handleSlashCommand()`, add `dispatchSkill()` function
- `src/shared/session/session.js` — add `expandSkillCommand()` helper (mirrors Pi's implementation)

## Reuse Opportunities

- `src/shared/session/session.js` — `listSkills()` already exists and returns `{ name, description, path, source }` for each skill
- `src/shared/session/session.js` — `steerRootSession()` for sending steering messages; `runAgentSession()` for agent invocations
- Pi's `_expandSkillCommand()` in `agent-session.ts` as the reference implementation for the XML wrapping format

## Implementation Steps

### 1. Add skill commands to autocomplete (chat-session.js)

After the prompt template map at line ~401, fetch skills and add them:
```js
const skills = await listSkills();
const skillCommands = skills.map((skill) => ({
    name: `skill:${skill.name}`,
    description: skill.description,
}));
```

Add `skillCommands` to the `CombinedAutocompleteProvider` array after prompt templates.

### 2. Add `expandSkillCommand()` helper (session.js)

Create a new exported function that:
- Takes a skill name and optional additional instructions
- Reads the SKILL.md file for that skill
- Strips YAML frontmatter
- Returns the formatted `<skill>...</skill>` XML string

### 3. Add skill dispatch in slash-dispatch.js

In `handleSlashCommand()`, after checking for templates (around line 57):
```js
if (command.startsWith("skill:")) {
    const skillName = command.slice(6);
    const skill = ctx.skills.find((s) => s.name === skillName);
    if (skill) {
        await dispatchSkill(ctx, skill, args.join(" "));
        return true;
    }
}
```

Add a new `dispatchSkill()` function that:
- Builds the slash context for `runAgentSession()`
- Calls `expandSkillCommand(skill.name, additionalInstructions)`
- Sends the result as a user message via `runAgentSession()`

### 4. Add skill to SlashContext and pass from chat-session

In `slash-dispatch.js`, update `SlashContext` typedef to include `skills: SkillMeta[]`.
In `chat-session.js`, call `listSkills()` once and pass it to `handleSlashCommand()`.

```js
// In chat-session.js
const skills = await listSkills();
const handledSlash = await handleSlashCommand({
    // ...existing fields...
    skills,
    chatPromptAgentName: CHAT_PROMPT_AGENT_NAME,
    // ...
});
```

## Verification Plan

- **Automated**: Run `deno run ci` — ensure no test regressions.
- **Manual flow**:
  1. Start `hns` interactively
  2. Type `/` — verify skills appear as `skill:diagnose`, `skill:ketch`, etc. in autocomplete
  3. Type `/skill:diagnose "my bug"` and press Enter
  4. Verify skill XML content appears in the chat as a user message (visible in the message stream)
  5. Verify agent follows the skill's instructions

## Edge Cases & Considerations

- **Unknown skill name**: If user types `/skill:nonexistent`, show "Unknown command: /skill:nonexistent" (not an error crash)
- **Unreadable SKILL.md file**: Catch read errors, show warning, don't crash the session
- **Skills with no description**: Skip from autocomplete list (consistent with prompt template behavior)
- **Priority**: Skills should be added to autocomplete after built-in commands but prompt templates are a preference — acceptable that skill commands appear after both in the list
- **Template name collision**: If a prompt template and skill share a name, prompt template wins (handled by template check coming first in `handleSlashCommand()`)