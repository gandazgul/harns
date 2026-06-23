---
classification: "FEATURE"
complexity: "HIGH"
summary: "Global rebranding of 'harns' to 'weild' (and 'hns' to 'wld'). This involves a massive search-and-replace across the codebase, updating the CLI binary name, renaming the global settings directory, and updating the ASCII boot logo. Special care is needed to preserve 'Harns' as the Router's name and maintain capitalization."
affectedPaths:
  - "src/cli.js"
  - "src/constants.js"
  - "src/shared/settings.js"
  - "src/shared/ui/boot-logo.js"
  - "src/shared/session/root-session.js"
  - "src/shared/models/model-registry.js"
  - "README.md"
  - "install.sh"
createdAt: "2026-06-22T22:20:48-04:00"
updatedAt: "2026-06-23T03:15:07.232Z"
status: "in_progress"
origin: "internal"
executionBaselineTree: "20700c8bbf2ac24cf72d9fef3eb8db7afa241d86"
worktreeId: "9826f218"
worktreePath: "/Users/gandazgul/.hns/worktrees/--Users-gandazgul-Documents-web-harns--/harns-harns-rename-harns-to-weild-9826f218"
worktreeBranch: "harns/worktree/rename-harns-to-weild-9826f218"
worktreeStatus: "active"
routingIntent: "FEATURE"
---
# Rename Harns to RunWeild

## Context

The product must be rebranded from Harns to RunWeild for copyright reasons. The user specifically requested:

- Rename `harns`/`Harns`/`HARNS` occurrences to `runweild`/`RunWeild`/`RUNWEILD`, respecting capitalization.
- Rename the installed CLI binary from `hns` to `wld`.
- Rename the global settings directory from `~/.hns` to `~/.wld`.
- Preserve the Router's display name as `Harns` as a nod to the project's origin.
- Replace the boot-logo `H.` shape with `W.` in the same block style, color, and blinking-dot behavior.
- Keep behavior otherwise unchanged.

This is a cross-cutting rename that touches runtime paths, persisted state, docs, release packaging, tests, and agent prompts.

## Objective

Implement a behavior-preserving rename so users invoke the tool as `wld`, see RunWeild branding and docs, store new global state under `~/.wld`, and still get the same routing/workflow/session behavior. The only intentional visible legacy name is the Router agent's display name `Harns` in `src/agent-definitions/router.md`.

## Approach

Perform the rebrand in layers rather than a blind replace:

1. Centralize/rename constants first (`CLI_BIN`, directory names, worktree prefixes, version symbol) so runtime surfaces and generated strings become `wld`/`runweild` from shared values.
2. Rename persisted-path logic from `.hns` to `.wld` and add compatibility migration/fallbacks for old `~/.hns` data. Existing one-time Pi migrations should continue, but target RunWeild-owned paths.
3. Rename user-facing strings, docs, comments, JSDoc symbols, test fixture values, and generated release asset names with capitalization preserved.
4. Rename context files from `HARNS.md` to `RUNWEILD.md`, while preserving `AGENTS.md` fallback behavior and reading legacy `HARNS.md` only as an explicit compatibility path.
5. Update boot logo arrays to render a block `W` plus blinking dot (`W.`), keeping the same `theme.fg("mdCode", ...)` styling, `dotOn`/`dotOff` animation, and interval behavior.
6. Sweep with targeted ripgrep to catch remaining `harns`, `Harns`, `HARNS`, `hns`, `HNS`, `.hns`, and old binary/asset names, allowing only explicitly intentional compatibility strings and Router display name `name: Harns`.

Avoid editing `.git/`, `.history/`, generated binary contents, or third-party lockfile package names unless a lockfile entry directly encodes the old project binary/package name.

## Files to Modify

- `src/constants.js` — change CLI binary to `wld`; rename product comments/constants to RunWeild; update metadata directory name to `.wld`; update worktree branch/path prefixes from `harns` to `runweild` for new worktrees while keeping old persisted entries usable.
- `src/cli.js` — update usage examples and error prefixes from `Harns`/`hns` to `RunWeild`/`wld`.
- `src/cmd/**` — update command help/usage/messages, install/remove package wrapper messaging, init text, snip-filter command text, tests, and any hardcoded `hns` usage.
- `src/shared/settings.js` and `src/shared/settings.test.js` — rename `HarnsSettingsStorage`, custom-setting terminology, `~/.hns` target paths, and tests; preserve Pi settings import behavior but target `~/.wld/settings.json`.
- `src/shared/models/model-registry.js` and tests — rename model config helpers and options from Harns terminology to RunWeild, target `~/.wld/models.json`/`auth.json`, and update migration tests.
- `src/shared/session/session.js`, `src/shared/session/root-session.js`, `src/shared/session/active-agent-session.js`, and related tests — update session directories, custom session marker type (`runweild.active_agent`), cache directories, global/project context file lookup, debug text, and tests.
- `src/shared/interactive/**` and `src/shared/ui/**` — update boot/header/banner branding and tests; redraw `src/shared/ui/boot-logo.js` as `W.`.
- `src/shared/worktree.js`, `src/shared/worktree-registry.js`, and tests — update registry paths and generated worktree branch/path prefixes for `runweild`; add migration/read tolerance if old registry files should remain discoverable.
- `src/shared/snip-filters.js`, `src/cmd/snip-filters/**`, and tests — rename managed marker/messages and `hns snip-filters` examples to `wld snip-filters`.
- `src/tools/**` — update user-visible system messages, tool names/comments such as `createHarnsGrepToolDefinition` if not externally referenced, and tests.
- `src/extensions/**` — update module comments and compatibility wording.
- `src/agent-definitions/**` — rename system prompt language from Harns system to RunWeild system, except keep `src/agent-definitions/router.md` front matter `name: Harns` unchanged.
- `src/prompt-templates/sleep.md` — update sleep-mode branding.
- `scripts/compile.js` — compile to `./bin/wld` instead of `./bin/hns`.
- `scripts/write-version.js` and `src/shared/version.js` — rename `HNS_VERSION` to a neutral `VERSION`, generated log prefix to `[wld]`, and update import sites.
- `.github/workflows/release.yml` — rename workflow, matrix binary names, artifact names, tarball names, and upload patterns from `hns` to `wld`; ensure Windows binary becomes `wld.exe`.
- `install.sh` — rename environment variables (`WLD_REPO`, `WLD_INSTALL_DIR`), installer log prefix (`[wld installer]`), asset names, binary extraction/install checks, PATH advice, Snip filter examples, and default repo to `gandazgul/runweild`.
- `README.md`, `docs/**`, and `TODO.md` — update user-facing docs and examples to RunWeild/`wld`/`~/.wld`/`RUNWEILD.md`.
- `HARNS.md` — rename to `RUNWEILD.md`; update references/tests accordingly and optionally read legacy `HARNS.md` for existing projects.
- `.hns/settings.json` and `.gitignore` — rename tracked project settings directory to `.wld`; update ignored debug/worktree paths.
- `.idea/modules.xml` and `.idea/harns.iml` — rename IDE module metadata if repository-tracked project names are included in the rebrand.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/constants.js` — use central constants (`CLI_BIN`, `HARNS_DIR_NAME`, worktree prefixes) rather than scattering string literals.
- `src/shared/settings.js` — extend the existing one-time migration style (`migratePiSettingsOnce`) for old `~/.hns` -> `~/.wld` compatibility instead of adding ad-hoc copies elsewhere.
- `src/shared/models/model-registry.js` — follow existing `migratePiModelConfigOnce` pattern for model/auth config migration.
- `src/shared/session/session.js` — preserve existing layered context lookup patterns (`RUNWEILD.md`/`AGENTS.md`/external `AGENTS.md`) and local/home/bundled prompt/skill precedence.
- `src/shared/session/root-session.js` — reuse `encodeCwdForSessionDir` unchanged for session directory names.
- `src/shared/ui/boot-logo.js` — preserve the existing `logo`, `dotOn`, `dotOff`, `renderBootLogo`, and `endBlink` structure while changing only the rendered block glyph layout.
- `scripts/write-version.js` + `.github/workflows/release.yml` — keep current generated-version workflow and release tarball structure, changing only names.

## Implementation Steps

- [ ] Step 1: Apply the resolved rename/migration boundaries:
  - Full project-local rename: `.hns` -> `.wld` and `HARNS.md` -> `RUNWEILD.md` across tracked files, source, docs, fixtures, and tests.
  - Preserve behavior by one-time migrating/copying old `~/.hns` data into `~/.wld` and reading old markers/paths as fallback where safe.
  - Use `gandazgul/runweild` as the default release repository in `install.sh`.
- [ ] Step 2: Rename central constants and generated version symbol:
  - `CLI_BIN: "wld"`.
  - Product comments/docs in `src/constants.js`.
  - Directory constants from Harns names to RunWeild names where applicable.
  - `HNS_VERSION` -> `VERSION` in `scripts/write-version.js`, generated `src/shared/version.js`, `src/shared/interactive/chat-session.js`, and `src/cmd/version/index.js`.
- [ ] Step 3: Update CLI/runtime user-facing strings:
  - Usage examples in `src/cli.js` and `src/cmd/registry.js` should use `wld`.
  - Error/log prefixes should use `[RunWeild]` except Router display-name contexts that intentionally show `Harns`.
  - `/version` should output `runweild <version> (<target-triple>)` unless product capitalization is desired as `RunWeild` in version output.
- [ ] Step 4: Rename global settings/model/auth storage to `~/.wld`:
  - Update `getSettingsDir("global")`, session base dir, bundled cache dirs, init-state path, model registry dir, worktree home parent, and package manager `agentDir` consumers.
  - Add one-time legacy copy helpers for existing `~/.hns` files/directories where safe; write new data only under `~/.wld`.
  - Keep Pi import behavior from `~/.pi/agent` but copy into `~/.wld`, after checking RunWeild and legacy Harns paths so existing user settings still win over Pi defaults.
- [ ] Step 5: Rename project-local metadata/context paths:
  - Change project metadata directory from `.hns` to `.wld` in constants and direct string literals.
  - Rename tracked `.hns/settings.json` to `.wld/settings.json`.
  - Change global/project context filename from `HARNS.md` to `RUNWEILD.md`, with `AGENTS.md` fallback still supported and legacy `HARNS.md` read only as a compatibility fallback.
  - Rename root `HARNS.md` to `RUNWEILD.md` and update tests/fixtures.
- [ ] Step 6: Update session custom marker naming:
  - Change `ACTIVE_AGENT_CUSTOM_TYPE` from `harns.active_agent` to `runweild.active_agent` for newly written markers.
  - Preserve old sessions by reading both `runweild.active_agent` and legacy `harns.active_agent`, while writing only the new type.
  - Update extractor scripts/tests that inspect active-agent markers.
- [ ] Step 7: Update worktree identifiers:
  - Change branch prefix from `harns/worktree/` to `runweild/worktree/` and path prefix from `harns-` to `runweild-` for newly created worktrees.
  - Ensure tests and plan front-matter fixtures expect new names.
  - Preserve old in-progress worktrees by treating persisted branch/path strings literally; do not rename/delete existing `harns/worktree/*` branches automatically.
- [ ] Step 8: Redraw `src/shared/ui/boot-logo.js`:
  - Replace the block `H` arrays with a block `W` in comparable dimensions/style.
  - Keep `dotOn` adding a block dot to the right and `dotOff` removing it.
  - Update module comment from Harns to RunWeild.
- [ ] Step 9: Update packaging/install/release:
  - `scripts/compile.js` output becomes `./bin/wld`.
  - `.github/workflows/release.yml` workflow/artifact/tarball/binary names become `wld`/`wld.exe`.
  - `install.sh` installs `wld`, downloads `wld-${VERSION}-${SUFFIX}.tar.gz`, checks executable `wld`, and emits `wld --help` instructions.
  - Rename installer env vars to `WLD_REPO` and `WLD_INSTALL_DIR`; support old `HNS_*` vars as deprecated fallbacks where practical to preserve behavior for existing install scripts.
  - Set the default repo slug to `gandazgul/runweild`.
- [ ] Step 10: Update all source tests and docs:
  - `src/**/*.test.js`, docs, README, TODO, and agent definitions should use RunWeild/`wld`/`.wld`/`RUNWEILD.md`.
  - Keep only `src/agent-definitions/router.md` front matter `name: Harns` and any intentionally documented legacy compatibility references.
- [ ] Step 11: Sweep and clean up:
  - Run `rg -n --hidden --glob '!.git/**' --glob '!.history/**' --glob '!plans/**' -i 'harns|hns|\.hns|HARNS'`.
  - Classify remaining matches as allowed exceptions (Router display name or legacy migration/fallback text) or fix them.
  - Run `rg -n 'HNS_VERSION|HarnsSettings|HarnsSession|getHarns|createHarns|installHarns|cleanupHarns|HARNS_DIR_NAME' src scripts` and rename public/internal symbols unless deliberately kept as compatibility aliases.
  - Run `git ls-files | rg '(^|/)harns|hns|HARNS|\.hns|Harns'` and rename tracked file paths where appropriate.
- [ ] Step 12: Format and fix all validation failures.

## Verification Plan

- Automated: `deno run ci`
- Automated targeted tests after the rename if failures need narrowing:
  - `deno test -A src/shared/settings.test.js src/shared/models/model-registry.test.js`
  - `deno test -A src/shared/session/session-catalog.test.js src/shared/session/root-session.test.js src/shared/session/active-agent-session.test.js` (or nearest existing session tests)
  - `deno test -A src/shared/worktree.test.js src/shared/worktree-registry.test.js`
  - `deno test -A src/cmd/version/index.test.js src/cmd/install/index.test.js src/cmd/help/index.test.js` if present/affected
- Automated search gates:
  - `rg -n --hidden --glob '!.git/**' --glob '!.history/**' --glob '!plans/**' -i 'harns|hns|\.hns|HARNS'` should show only approved exceptions.
  - `rg -n 'hns-|/hns| hns|HNS_|\.hns' install.sh .github src README.md docs TODO.md` should show only approved legacy compatibility references.
- Manual:
  - Run `deno run -A src/cli.js --version`; expect RunWeild/wld version output with unchanged target triple.
  - Run `deno run -A src/cli.js --help`; expect `wld` usage examples and no old product branding except Router `Harns` if listed.
  - Start a TUI session; expect the title/header to say RunWeild and boot logo to render `W.` with the dot blinking.
  - Confirm global settings/auth/models/session/init-state files are read/written under `~/.wld`.
  - Seed `~/.hns/settings.json`, `models.json`, `auth.json`, old sessions, and legacy context files where practical; verify RunWeild migrates or reads them as specified without deleting old data.
  - Run `deno task compile`; expect `bin/wld` to be produced.

## Edge Cases & Considerations

- Project-local rename boundary is resolved: perform the full rename, including `.hns` -> `.wld` and `HARNS.md` -> `RUNWEILD.md`.
- Existing user state compatibility is resolved: preserve behavior by migrating/copying old `~/.hns` settings, auth, models, sessions, bundled caches, init-state, and worktree registry data into `~/.wld` where safe. Do not delete old data automatically.
- Router exception: Keep `src/agent-definitions/router.md` front matter `name: Harns`. The rest of the Router prompt can say RunWeild unless the user wants the entire Router persona to remain Harns-branded.
- Custom session marker: Renaming `harns.active_agent` to `runweild.active_agent` can make old sessions lose active-agent continuity unless read compatibility is added.
- Worktree branch prefixes: Existing `harns/worktree/*` branches should not be deleted or renamed automatically. New worktrees can use `runweild/worktree/*`; merge/resume code should continue to handle persisted branch strings literally.
- Release/install compatibility: If old release assets remain named `hns-*`, the new installer will not install older versions unless it has a legacy fallback. Decide whether that is necessary.
- Repository slug is resolved: `install.sh` should default to `gandazgul/runweild`, while still allowing `WLD_REPO` override.
- Pure JavaScript only: Any new helper types should be JSDoc, not TypeScript syntax.
