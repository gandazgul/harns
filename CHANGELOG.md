# Changelog

## v0.2.0 (2026-06-14)

### New Features

- **Theme Engine**: Dynamic theme management with external theme file support, Catppuccin Mocha theme, and `/theme`
  slash command with live previews
- **Skills System**: Load external skills from `~/.agents/skills/`, `/skill:{name}` slash command with autocomplete,
  skill expansion during LLM invocation
- **Agent Definition System**: Layered agent definitions (bundled → home → local), frontmatter-based tool permissions,
  agent model presets and JSONC settings
- **Multi-Agent Orchestration**: Full orchestrator with DAG-based parallel task execution, slicer agent, and
  post-execution validation loop
- **Plan Management**: YAML front-matter handling, self-healing for malformed entries, plan archival, load/save/reload
  commands
- **Interactive TUI Enhancements**: Dynamic agent switching, Esc-key unified cancellation, Shift+Tab thinking level
  cycling, searchable prompt lists, project status footer
- **Session Management**: Persisted sessions with `--continue` startup mode, compaction offer on resume, `/export` to
  HTML/JSONL, message queuing, root session rebuild on resume
- **Tools & Commands**: `multi_replace_file_content` edit tool, `edit-with-fallback` tool, `switch_agent` tool,
  `user_interview` tool, `/share` (GitHub Gist export), `/model` slash command, `!`/`!!` bash execution
- **Tool Policy Enforcement**: Configurable agent tool permissions through frontmatter, write-access restrictions, sed
  blocking in bash tool
- **Model Resolution**: Integrated ModelSelectorComponent, configurable model presets per agent, improved provider/id
  parsing
- **Codebase Integration**: Cymbal AST-aware search (code_search, code_show, code_outline, code_refs, etc.), Mnemosyne
  semantic memory, @-autocomplete via CombinedAutocompleteProvider
- **Documentation & Skills**: Added skills for architecture improvement, diagnosis, prototyping, TDD, triage, and more
- **CI/Infrastructure**: Deno compilation with version injection, unit test suite, automated formatting checks

### Bug Fixes and Improvements

- Fixed `/skill:` invocation so LLM follows skill instructions correctly
- Fixed circular dependency in chat-session.js
- Fixed footer redundancy, model autocomplete trigger, and provider display
- Fixed interleaved model/tool messages in TUI
- Fixed steering message visual flow and session handoff dispatch
- Fixed regex escape in clipboard base64 parsing for plan loading
- Fixed task frame advancement and multiple command submissions
- Fixed StyledBlock test content extraction
- Improved block spacing, system prefix styling, and interrupt handling
- Standardized agent display names and terminology across codebase
- Refactored interactive session into extracted modules (keybindings, slash-dispatch, bash-interceptor, etc.)
- Refactored command registry to structured CommandDefinition format
- Consolidated plan/document formats into agent-definitions
- Removed dead code, obsolete docs, and unused imports
- Applied consistent formatting and linting across all source files
- Upgraded pi-agent dependencies to v0.73.0

### Breaking Changes

- None
