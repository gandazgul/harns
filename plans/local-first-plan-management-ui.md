---
classification: "PROJECT"
complexity: "HIGH"
summary: "Build a local-first browser Workspace for managing canonical markdown Plans, with durable Plan IDs, REST APIs, lifecycle-safe board actions, Epic detail views, and a body-only markdown editor."
affectedPaths:
    - "docs/adr/007-local-first-workspace-plan-board.md"
    - "docs/plan-lifecycle.md"
    - "docs/prd/local-first-plan-management-ui-PRD.md"
    - "src/cmd/plans/index.js"
    - "src/cmd/plans/ui.js"
    - "src/cmd/plans/index.test.js"
    - "src/cmd/registry.js"
    - "src/constants.js"
    - "src/plan-store.js"
    - "src/plan-store.test.js"
    - "src/shared/workflow/plan-lifecycle.js"
    - "src/shared/workflow/plan-lifecycle.test.js"
    - "src/ui/workspace/"
    - "deno.json"
createdAt: "2026-06-24T13:10:29-04:00"
updatedAt: "2026-06-24T18:42:57.414Z"
status: "draft"
origin: "internal"
---

# Local-First Plan Management UI

## Context

<<<<<<< HEAD
RunWield Plans are canonical markdown files under `plans/` with YAML front matter. The current management surface is
=======
RunWeild Plans are canonical markdown files under `plans/` with YAML front matter. The current management surface is
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348
terminal-first: `wld plans` lists saved Plans and `wld load-plan` resumes one Plan, but there is no persistent visual
workspace for comparing active work, reading Plan bodies, editing safely, inspecting Epic progress, or manually moving
Plans through lifecycle states.

<<<<<<< HEAD
The primary product source is `docs/prd/local-first-plan-management-ui-PRD.md`. The architectural decision has already
been recorded in `docs/adr/007-local-first-workspace-plan-board.md`: v1 is a local-first Workspace Plan Board over
canonical markdown, launched by `wld plans ui`, with durable `planId` identity, REST/JSON APIs, lifecycle-mediated board
actions, and a conservative markdown body editor. Future hosted/self-hosted collaboration and encrypted remote storage
remain intentionally out of scope for this Epic.
=======
The primary PRD is `docs/prd/local-first-plan-management-ui-PRD.md`. `docs/prd/collaborative-planning-PRD.md` is
relevant as a future direction: the local UI should introduce durable resource identity and shareable route concepts
now, without implementing remote storage, encrypted collaboration, accounts, or a database in v1.
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348

User decisions captured before this finalization:

<<<<<<< HEAD
- The v1 editor is CodeMirror-style/body-only markdown editing. BlockSuite is deferred from the first production editor
  path.
- Durable Plan URLs use a new globally unique `planId` front matter field, lazily/backfilled for existing Plans.
- Board-required statuses and events (`closed_without_verification`, manual board movement, `on_hold`) extend the
  central Plan Lifecycle module rather than creating a second lifecycle system.
- The Workspace is project-scoped: one local server instance shows the checkout from which `wld plans ui` was launched,
  not a global multi-project dashboard.

## Objective

Build `wld plans ui`: a local-first browser Plan Workspace launched from the current checkout. The implementation must
preserve markdown Plan files as the source of truth while adding:

- A Workspace app boundary under `src/ui/workspace/` backed by Fresh 2, Vite, Preact islands, UnoCSS, and
  JavaScript/JSDoc-only source. Do not add TypeScript files or TypeScript syntax.
- A local REST/JSON API over the existing Plan store and Plan Lifecycle seams.
- Stable `planId` resource identity for durable project-scoped URLs that survive Plan title/path changes.
- A custom RunWield Plan Board grouped by lifecycle visibility: active work, closed work, and on-hold work.
- Epic cards and Epic detail views that summarize child FEATURE progress without flattening children onto the main board
  by default.
- Read-first Plan detail pages with rendered markdown and front matter summaries.
- A save-only body editor that cannot directly mutate workflow-critical front matter.
- Structured lifecycle/manual actions for status moves, including `closed_without_verification` and `on_hold` support
  through `src/shared/workflow/plan-lifecycle.js`.
- Localhost security controls: default bind to `127.0.0.1`, explicit opt-in bind override, random per-server session
  token for state-changing requests, no permissive CORS, and filesystem sandboxing beneath the launched checkout.

Out of scope for this Epic: remote hosted/self-hosted collaboration, end-to-end encryption, real-time editing,
comments/annotations, notifications, global multi-project dashboards, AFFiNE-the-app, BlockSuite as the board,
BlockSuite as the v1 Plan editor, and any local database that would replace markdown as canonical Plan state.

## Vertical Slice Findings

- `src/cmd/plans/index.js` is currently a list-only CLI command. Its private grouping semantics are important product
  behavior: Epics are `classification: PROJECT` plus `type: epic`, child FEATURE Plans point to `parentPlan`, and
  orphaned children are separated. The Workspace API should extract/reuse these semantics so terminal and browser views
  do not drift.
- `src/plan-store.js` owns canonical Plan persistence. It currently treats the filename/path as identity and has no
  `planId` field. It already parses and rewrites front matter, preserves unknown keys through parse/inject paths, lists
  nested Plans recursively, hides top-level `plans/archived`, and exposes `loadPlan`, `listPlans`,
  `updatePlanFrontMatter`, and `findPlansByParent` seams that can support local API adapters.
- `src/shared/workflow/plan-lifecycle.js` is the accepted central lifecycle state machine per the lifecycle docs. It
  currently supports statuses through `verified` and does not implement `closed_without_verification`, `on_hold`,
  `manual_status_change`, `plan_held`, `hold_resumed`, or `hold_reset_to_draft`. Board movement must extend this module
  instead of directly writing `status` in YAML.
- `docs/plan-lifecycle.md` documents the current invariant that workflow code records Plan Events instead of directly
  mutating Plan Status. New board/manual transitions must update this document only when code support lands.
- `docs/prd/on-hold-plan-status.md` defines `on_hold`, `heldFromStatus`, `heldAt`, `holdReason`,
  `holdStalenessBaseline`, and Resume Check semantics. The UI should expose on-hold behavior only through those central
  lifecycle semantics, not a UI-only flag.
- The Fresh prototype under `prototypes/fresh-plan-ui/` proved the Deno/Fresh/Vite/Preact/UnoCSS stack shape and showed
  that hydrated islands require the Fresh Vite pipeline rather than a direct `App.listen()` shortcut. It also proved
  that BlockSuite's database/Kanban is not the right owner for RunWield Plan Board semantics.
- Current Fresh docs confirm Fresh 2 uses Vite and the Fresh Vite plugin handles JSX configuration, HMR, island
  discovery, client/server code splitting, and React-to-Preact aliasing. The Fresh plugin should be first in the Vite
  plugin chain.
- Current CodeMirror 6 docs confirm the v1 editor can be built from `EditorView`, `basicSetup`, and
  `@codemirror/lang-markdown`, matching the selected body-only markdown-source editing strategy.
- The repository policy is JavaScript-only. If the implementation spike proves Fresh routing or islands cannot be made
  to work with project-acceptable JavaScript source files, stop and return for a design decision rather than quietly
  introducing `.ts`/`.tsx` or TypeScript syntax.

## Files to Modify

- `README.md` — document how to launch the Plan Workspace, what `--bind`/`--host` exposure means, and that v1 is local
  plaintext over the current checkout. Keep the docs concise and link to lifecycle/PRD details rather than duplicating
  all semantics.
- `docs/adr/007-local-first-workspace-plan-board.md` — existing accepted ADR. Treat it as the architectural contract;
  modify only if implementation discovers that an accepted decision must change.
- `docs/plan-lifecycle.md` — after lifecycle code support lands, document `closed_without_verification`, manual board
  movement, `on_hold`, hold metadata, Resume Check behavior, and the distinction between Workflow Validation `verified`
  and manual closure.
- `docs/prd/local-first-plan-management-ui-PRD.md` — update status/notes after implementation if needed, especially to
  reflect that v1 shipped with CodeMirror-style body editing and deferred BlockSuite from the first production editor
  path.
- `src/cmd/plans/index.js` — evolve `wld plans` into a small subcommand dispatcher while preserving current list
  behavior as the default. Delegate `wld plans ui` to `src/cmd/plans/ui.js`. Extract Plan hierarchy/grouping helpers
  from private CLI functions into a shared location so the CLI and Workspace API share Epic/child/orphan semantics.
- `src/cmd/plans/ui.js` — new CLI launch boundary. Parse `--host`/`--bind`, `--port`, `--no-open`, and `--help`; bind to
  `127.0.0.1` by default; create a random per-server session token; start the Workspace server for the current checkout;
  print/open the browser URL; warn when binding outside loopback; and handle shutdown cleanly.
- `src/cmd/plans/index.test.js` — cover default listing compatibility plus `ui` subcommand delegation, help text, flag
  parsing, and non-loopback warning behavior.
- `src/cmd/registry.js` — update command usage/help metadata so `wld plans ui` and its flags are discoverable without
  changing `plans` into an interactive slash command.
- `src/constants.js` — add shared constants for Plan UI defaults and token/header names where useful, such as default
  host, default port behavior, command labels, or environment variable names. Do not hard-code absolute paths.
- `src/plan-store.js` — add Plan resource identity and body-save seams:
  - `planId` front matter parsing/formatting/JSDoc, generated with a globally unique random ID such as
    `crypto.randomUUID()`.
  - Idempotent `ensurePlanIdentity` / backfill helpers that preserve existing IDs and fail loudly on duplicate IDs.
  - Lookup by `planId` while still returning canonical `planName`, project-relative path, absolute path, front matter,
    and body metadata for existing CLI workflows.
  - Body-only save helper that preserves front matter fields and rejects stale saves when a caller provides an old body
    hash or revision token.
  - Shared Plan hierarchy/grouping helpers for Epics, children, standalone Plans, orphaned children, and progress
    counts.
  - Optional project/workspace metadata needed by the UI that does not require introducing a database.
- `src/plan-store.test.js` — cover `planId` creation, preservation, duplicate/collision behavior, lookup by `planId`,
  body-save front matter preservation, stale body-save rejection, archived-plan hiding, and shared hierarchy grouping.
- `src/shared/workflow/plan-lifecycle.js` — extend the central lifecycle with board-safe events/statuses. Required
  constraints:
  - Add `closed_without_verification` as a terminal manual status distinct from `verified`.
  - Keep `verified` reserved for Workflow Validation, except the existing Epic `done_enough` exception.
  - Add manual board movement through a lifecycle-owned event/helper; it may move among safe non-terminal statuses but
    must not casually enter/leave `failed`, enter `verified`, bypass recovery, or imply validation.
  - Add `on_hold` and hold metadata using `docs/prd/on-hold-plan-status.md` semantics: `heldFromStatus`, `heldAt`,
    optional `holdReason`, `holdStalenessBaseline`, `plan_held`, `hold_resumed`, and `hold_reset_to_draft`.
  - Holding/resuming mutates only the selected Plan. Epic/child visibility and blocking rules are listing/UI behavior,
    not child-status mutation.
  - Recovery-specific states remain recovery-specific; board drag-and-drop cannot paper over failed execution,
    validation failures, or merge conflicts.
- `src/shared/workflow/plan-lifecycle.test.js` — add transition tests for manual movement, manual closure,
  hold/resume/reset, blocked direct verification, blocked casual failed transitions, Epic hold behavior, child hold
  behavior, metadata creation/clearing, and existing transition compatibility.
- `src/ui/workspace/` — new Workspace app boundary. Expected internal shape:
  - Local `deno.json` with JS/JSDoc checking, Vite client types, Fresh 2, Preact, signals, UnoCSS, CodeMirror 6 markdown
    dependencies, and local UI tasks.
  - `vite.config.js` with the Fresh plugin first and UnoCSS through Vite.
  - Fresh server/client entry modules and route modules written with project-approved JavaScript/JSDoc only; no `.ts`,
    `.tsx`, interfaces, type aliases, or TypeScript syntax.
  - Routes for the board, closed screen, on-hold screen, Plan detail, Epic detail, and REST API endpoints.
  - Islands/components for the board, drag/drop or equivalent move controls, editor, filters, and browser-local unsaved
    draft recovery.
  - Server-side adapters that import `src/plan-store.js` and `src/shared/workflow/plan-lifecycle.js`; browser code calls
    APIs and never imports filesystem helpers.
  - Shared UI modules/components for Plan cards, status columns, Epic progress, markdown rendering, front matter
    summaries, worktree/dependency summaries, and lifecycle action controls.
- `deno.json` — add root imports/tasks only as needed to make the Workspace app verifiable from normal repo CI. Keep the
  CLI core understandable and avoid pulling browser-only dependencies into unrelated runtime paths.
- `deno.lock` — update only as required by dependency resolution for the Workspace package/root tasks.
=======
- The v1 editor should be CodeMirror-style/body-only markdown editing. BlockSuite is deferred entirely from the first
  production editor path.
- Durable Plan URLs should use a new globally unique `planId` front matter field, lazily/backfilled for existing Plans.
- The board should extend the existing Plan Lifecycle module for new UI-required transitions/statuses; it must not
  create a second lifecycle system.

ADR created: `docs/adr/007-local-first-workspace-plan-board.md`.

## Objective

Build `wld plans ui`: a local-first browser Plan Workspace launched from the current checkout. The UI must preserve
markdown Plan files as the source of truth while adding:

- A Workspace shell under `src/ui/workspace/` backed by Fresh 2, Vite, Preact islands, UnoCSS, and JavaScript/JSDoc
  only.
- A local REST/JSON API over the existing Plan store and Plan Lifecycle seams.
- Stable `planId` resource identity for pretty, durable project-scoped URLs.
- A custom RunWeild Plan Board grouped by lifecycle status, with active, closed, and on-hold visibility concepts.
- Epic cards and Epic detail views that summarize child FEATURE progress without flattening children onto the main board
  by default.
- Read-first Plan detail pages with rendered markdown and front matter summaries.
- A save-only body editor that cannot directly corrupt workflow-critical front matter.
- Structured lifecycle/manual actions for status moves, including `closed_without_verification` and `on_hold` support
  through the central lifecycle module.
- Localhost security controls: default bind to `127.0.0.1`, explicit opt-in bind override, random session token for
  state-changing requests, no permissive CORS, and filesystem sandboxing beneath the launched checkout.

Out of scope for this Epic: remote hosted/self-hosted collaboration, end-to-end encryption, real-time editing,
comments/annotations, notifications, global multi-project dashboards, AFFiNE-the-app, BlockSuite as the board,
BlockSuite as the v1 editor, or a local database.

## Vertical Slice Findings

- `src/cmd/plans/index.js` is currently a list-only CLI command. It already has useful private grouping semantics: Epics
  are `classification: PROJECT` plus `type: epic`, child FEATURE Plans point to `parentPlan`, and orphaned children are
  separated. The UI should reuse this grouping behavior through shared helpers rather than reimplement it separately in
  browser code.
- `src/plan-store.js` owns canonical Plan persistence. It currently treats the filename/path as the plan identity and
  has no `planId` field. It parses and rewrites front matter, preserves unknown keys, lists nested Plans recursively,
  hides top-level `plans/archived`, and exposes `loadPlan`, `listPlans`, `updatePlanFrontMatter`, and
  `findPlansByParent` seams that can support a local API adapter.
- `src/shared/workflow/plan-lifecycle.js` is the accepted central lifecycle state machine per ADR-004. It currently
  supports statuses through `verified` and does not implement `closed_without_verification`, `on_hold`,
  `manual_status_change`, `plan_held`, `hold_resumed`, or `hold_reset_to_draft`. The Plan Board must extend this module
  instead of mutating `status` directly.
- `docs/plan-lifecycle.md` documents the current invariant that workflow code records Plan Events instead of directly
  mutating Plan Status. New board/manual transitions must update this document only when code support lands.
- `docs/prd/on-hold-plan-status.md` specifies `on_hold`, `heldFromStatus`, `heldAt`, `holdReason`,
  `holdStalenessBaseline`, and Resume Check semantics, but repo code currently has no `on_hold` implementation. The
  board can expose an on-hold screen only after these central lifecycle fields/events exist.
- The Fresh prototype under `prototypes/fresh-plan-ui/` proved `.js`/`.jsx` Fresh routes, server-rendered markdown,
  Preact island hydration, UnoCSS via Vite, and Fresh's Vite pipeline. It also showed that direct `App.listen()` is not
  sufficient for hydrated islands.
- Current Fresh 2 docs confirm the Vite plugin handles JSX configuration, HMR, island discovery, client/server code
  splitting, React-to-Preact aliasing, and production builds. The Fresh plugin should generally run before other Vite
  plugins.
- CodeMirror 6 markdown docs show a minimal editor surface built from `EditorView`, `basicSetup`, and
  `@codemirror/lang-markdown`. This matches the user-selected v1 strategy: safe markdown source editing rather than rich
  markdown round-tripping.
- BlockSuite docs and prototype results confirm adapters can import/export snapshots, but adapter conversion may be
  lossy and the prototype normalized canonical Plan markdown. BlockSuite remains a future adapter candidate, not a v1
  dependency for Plan body saves.

## Files to Modify

- `docs/adr/007-local-first-workspace-plan-board.md` — records the architectural decision to build a local-first
  Workspace Plan Board over canonical markdown files, use stable `planId`, keep board lifecycle RunWeild-owned, and
  choose a CodeMirror-style editor for v1.
- `docs/plan-lifecycle.md` — document new lifecycle statuses/events only after they exist in code:
  `closed_without_verification`, manual board movement, `on_hold`, hold metadata, and the distinction between `verified`
  and manual closure.
- `docs/prd/local-first-plan-management-ui-PRD.md` — optionally update status/notes after implementation to reflect that
  v1 chose CodeMirror-style editing and deferred BlockSuite from the first production editor path.
- `src/cmd/plans/index.js` — evolve `wld plans` into a small subcommand dispatcher while preserving current list
  behavior as the default. Delegate `wld plans ui` to `src/cmd/plans/ui.js`.
- `src/cmd/plans/ui.js` — new CLI launch boundary. Parse `--host`/`--bind`, `--port`, `--no-open`, and `--help`; bind to
  `127.0.0.1` by default; create a random session token; start the Workspace server for the current checkout; print/open
  the browser URL; and handle shutdown cleanly.
- `src/cmd/plans/index.test.js` — cover default listing compatibility plus `ui` subcommand delegation and argument
  parsing.
- `src/cmd/registry.js` — update command usage/help metadata so `wld plans ui` is discoverable without changing the
  command's CLI-only surface.
- `src/constants.js` — add any shared constants needed for Plan UI defaults, such as default host, command labels, or
  Plan UI environment variable names. Do not hard-code absolute paths.
- `src/plan-store.js` — add Plan identity support and body-save seams:
  - `planId` front matter parsing/formatting/JSDoc.
  - idempotent `ensurePlanIdentity` / backfill helpers using globally unique random IDs.
  - lookup by `planId` while still returning canonical `planName` and `path`.
  - body-only save helper that preserves front matter fields and rejects stale saves when a caller provides an old body
    hash or revision token.
  - shared Plan hierarchy/grouping helpers so CLI and UI use one interpretation of Epics, children, standalone Plans,
    and orphaned children.
- `src/plan-store.test.js` — cover `planId` creation/preservation/collision behavior, lookup by `planId`, front matter
  preservation on body save, stale body save rejection, and shared hierarchy grouping.
- `src/shared/workflow/plan-lifecycle.js` — extend the central lifecycle with board-safe events/statuses. Required
  design constraints:
  - `verified` remains reserved for Workflow Validation, except the existing Epic `done_enough` exception.
  - `closed_without_verification` is a terminal manual status distinct from `verified`.
  - `manual_status_change` may cover reversible user moves among safe non-terminal statuses, but must not casually
    enter/leave `failed`, enter `verified`, or bypass recovery/validation semantics.
  - `on_hold` and hold metadata follow `docs/prd/on-hold-plan-status.md`; holding/resuming mutates only the selected
    Plan, with Epic/child visibility rules handled by listing/UI.
  - Recovery-specific states remain recovery-specific; board drag-and-drop cannot paper over `failed`, validation
    failures, or merge conflicts.
- `src/shared/workflow/plan-lifecycle.test.js` — add transition tests for manual movement, manual closure,
  hold/resume/reset, blocked direct verification, blocked casual failed transitions, Epic hold behavior, and metadata
  clearing.
- `src/ui/workspace/` — new Workspace app boundary. Expected internal shape:
  - `deno.json` with JS/JSDoc, JSX, Vite client types, Fresh 2, Preact, signals, UnoCSS, CodeMirror 6 markdown
    dependencies, and local UI tasks.
  - `vite.config.js` with Fresh plugin first and UnoCSS through Vite.
  - `main.js` / `client.js` Fresh entry points.
  - `routes/` for project-scoped board, Plan detail, Epic detail, closed/on-hold screens, and REST API routes.
  - `islands/` for interactive board, drag/drop, editor, filters, and browser-local unsaved draft recovery.
  - server-side adapters that import `src/plan-store.js` and `src/shared/workflow/plan-lifecycle.js`; browser code must
    call APIs, not filesystem helpers.
  - shared UI modules/components for Plan cards, status columns, Epic progress, markdown rendering, front matter
    summaries, and lifecycle action controls.
- `deno.json` — add root imports/tasks only as needed to make the Workspace app verifiable from normal repo CI. Keep
  executable source JavaScript-only; do not introduce TypeScript config/files.
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/plan-store.js` — reuse `loadPlan`, `listPlans`, `findPlansByParent`, `updatePlanFrontMatter`, front matter
<<<<<<< HEAD
  parsing, nested plan canonicalization, archived-plan hiding, child FEATURE persistence rules, and body/front matter
  injection behavior.
- `src/cmd/plans/index.js` — extract/reuse current Epic/child/standalone/orphan grouping and child progress concepts so
  CLI and UI stay semantically aligned.
- `src/shared/workflow/plan-lifecycle.js` — extend lifecycle event/update helpers rather than introducing direct status
  writes from the board.
- `docs/plan-lifecycle.md` and `docs/prd/on-hold-plan-status.md` — use existing lifecycle language and hold/resume terms
  as the contract for UI copy and action gating.
=======
  parsing, nested plan canonicalization, archived-plan hiding, and child FEATURE persistence rules.
- `src/cmd/plans/index.js` — extract/reuse current Epic/child/standalone/orphan grouping and progress concepts so CLI
  and UI stay semantically aligned.
- `src/shared/workflow/plan-lifecycle.js` — extend `recordPlanEvent` / `buildPlanEventUpdates` instead of introducing
  direct status writes from the board.
- `docs/plan-lifecycle.md` — use existing lifecycle language and invariants as the contract for UI copy and action
  gating.
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348
- `prototypes/fresh-plan-ui/` — reuse proven stack decisions and Vite/UnoCSS/Fresh shape, but do not copy the BlockSuite
  Kanban proof as production board architecture.
- Fresh 2 Vite pattern — use Fresh for file routing/API routes/server rendering, Preact islands for hydrated
  interactions, and Vite for island/client bundling.
<<<<<<< HEAD
- CodeMirror 6 markdown pattern — use `codemirror` plus `@codemirror/lang-markdown` for source-preserving markdown
  editing.
- Existing worktree front matter fields — surface `worktreeStatus`, `worktreeBranch`, `worktreePath`, `failureReason`,
  and related recovery metadata read-only in Plan detail/cards.
=======
- CodeMirror 6 markdown package pattern — use `codemirror` plus `@codemirror/lang-markdown` for source-preserving
  markdown editing.
- Existing worktree front matter fields — surface `worktreeStatus`, `worktreeBranch`, `worktreePath`, and related
  recovery metadata read-only in Plan detail cards.
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348

## Verification Plan

- Automated: exact command(s) to run
  - `deno task ci`
  - `deno task -c src/ui/workspace/deno.json check`
  - `deno task -c src/ui/workspace/deno.json test`
  - If browser automation is added in the Workspace package, `deno task -c src/ui/workspace/deno.json e2e`
- Manual: precise user flows / checks
  - Run `wld plans` in a repo with existing Plans and verify current terminal output semantics remain intact.
<<<<<<< HEAD
  - Run `wld plans ui`; verify it starts on `127.0.0.1` by default, opens/prints a URL that bootstraps the session
    token, and shows Plans from the current checkout only.
  - Run `wld plans ui --bind 0.0.0.0` or equivalent explicitly and verify the command warns/documents that this exposes
    the local UI beyond loopback.
  - Start with Plans that lack `planId`; verify IDs are backfilled once, links remain stable after browser
    refresh/restart, and Plan bodies are unchanged.
  - Create or simulate duplicate existing `planId` values; verify the API fails loudly with a repair-oriented error
    instead of silently rewriting user data.
=======
  - Run `wld plans ui`; verify it starts on `127.0.0.1` by default, opens/prints a URL with a session token, and shows
    Plans from the current checkout only.
  - Start with Plans that lack `planId`; verify IDs are backfilled once, links remain stable after browser
    refresh/restart, and Plan bodies are unchanged.
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348
  - Open the active board and verify draft, feedback, approved, ready-for-decomposition, ready-for-work, in-progress,
    failed, and implemented columns/cards appear as supported.
  - Verify terminal statuses appear outside the active board: `verified` and `closed_without_verification` in the closed
    screen; `on_hold` in the on-hold screen.
  - Open a standalone FEATURE Plan card; verify read-first markdown rendering, front matter summary, worktree/dependency
    metadata, Edit action, and body-only save.
  - Edit a body, refresh before saving, and verify browser-local draft recovery; save explicitly and verify front matter
    remains valid and workflow-critical fields are unchanged.
  - Simulate an external disk edit between open and save; verify stale save protection prevents silent overwrite.
<<<<<<< HEAD
  - Move a Plan through allowed manual statuses and verify the API records lifecycle/manual updates through the central
    lifecycle module rather than direct YAML mutation.
  - Attempt blocked moves: FEATURE directly to `verified`, casual entry/exit of `failed`, Resume from hold without the
    designed Resume Check path, and any state-changing request without the token.
  - Open an Epic card; verify child progress, child list, dependencies, held children, failed children, and orphan-child
    behavior match `wld plans` concepts.
  - Put an Epic on hold and verify child FEATURE statuses do not change; held-Epic visibility/blocking comes from the UI
    hierarchy rules.
=======
  - Drag or otherwise move a Plan through allowed manual statuses and verify the API records lifecycle/manual events
    through the central lifecycle module rather than direct YAML mutation.
  - Attempt blocked moves: FEATURE directly to `verified`, casual entry/exit of `failed`, resume from `on_hold` without
    the designed Resume Check path, and any state-changing request without the token.
  - Open an Epic card; verify child progress, child list, dependencies, held children, failed children, and orphan-child
    behavior match `wld plans` concepts.
  - Use `--bind 0.0.0.0` explicitly and verify the command warns or documents that this exposes the local UI beyond
    loopback.
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348
- Expected results for key scenarios
  - Markdown files remain canonical and readable by existing agents/CLI after UI edits.
  - `verified` is never produced by board movement for FEATURE Plans.
  - `closed_without_verification` gives users a terminal manual outcome without pretending Workflow Validation passed.
<<<<<<< HEAD
  - Plan URLs use stable `planId` values and continue resolving after title/name changes as long as the front matter ID
    remains.
=======
  - Plan URLs use stable `planId` values and continue resolving after file title/name changes as long as the front
    matter ID remains.
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348
  - Browser code cannot read arbitrary files; all Plan access is mediated by server-side adapters scoped to the
    checkout.

## Edge Cases & Considerations

<<<<<<< HEAD
- Existing Plans without `planId` — backfill must be idempotent and body-preserving. Build an index first, preserve
  existing IDs, and treat duplicates as a repair error rather than silently changing user data.
- File rename vs. durable URL — API responses should carry both `planId` and canonical `planName`; routes resolve by
  `planId`, while existing CLI workflows may continue using names/paths.
- Route shape — prefer stable project-scoped routes such as `/plans/:planId`, `/plans/closed`, `/plans/on-hold`, and
  query parameters for shareable filters. Optional readable slugs must not be required for lookup.
- Token handling — the launch URL may bootstrap the random token, but state-changing requests should send it in an
  explicit same-origin header. Do not enable permissive CORS, and do not expose arbitrary path read/write endpoints.
- Body save races — use a body hash/revision comparison to reject stale saves rather than overwriting external edits
  made by another RunWield process or editor.
- Front matter corruption — the default editor edits only body markdown. Structured controls and lifecycle APIs own
  status, dependencies, parent pointers, classification, complexity, worktree fields, and hold metadata.
- Lifecycle ambiguity — `manual_status_change` must be narrow. Anything that implies validation, recovery, failed-state
  repair, merge-back, or worktree cleanup remains outside drag-and-drop.
- On-hold dependency — the board can expose on-hold screens only after `on_hold` is implemented in the central lifecycle
  module. Do not fake held state as a UI-only category.
=======
- Existing Plans without `planId` — backfill must be idempotent and body-preserving. Duplicate existing IDs should fail
  loudly with a repair message instead of silently rewriting user data.
- File rename vs. durable URL — API responses should carry both `planId` and canonical `planName`; routes resolve by
  `planId`, while existing CLI workflows may continue using names/paths.
- Body save races — use body hash/revision comparison to reject stale saves rather than overwriting external edits made
  by another RunWeild process or editor.
- Front matter corruption — the default editor edits only body markdown. Structured controls and lifecycle APIs own
  status, dependencies, parent pointers, classification, complexity, and worktree fields.
- Lifecycle ambiguity — `manual_status_change` must be narrow. Anything that implies validation, recovery, failed-state
  repair, or merge-back remains outside drag-and-drop.
- On-hold dependency — the UI PRD wants an on-hold screen, but code does not implement `on_hold` yet. This Epic should
  extend the existing lifecycle module using `docs/prd/on-hold-plan-status.md` semantics; if sliced separately, board UI
  must gate on that support rather than fake it.
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348
- Epic semantics — holding an Epic affects visibility/blocking of children but does not mutate child statuses; holding a
  child mutates only that child.
- Local server security — token, loopback binding, path sandboxing, no permissive CORS, and no raw arbitrary-path API
  are required even though this is localhost/plaintext.
<<<<<<< HEAD
- Fresh/Vite packaging — hydrated islands require the Fresh Vite pipeline. Avoid the direct `App.listen()` shortcut that
  the prototype found insufficient.
- JavaScript strictness — all executable code must be JavaScript/JSDoc. Do not add `.ts`, `.tsx`, interfaces, type
  aliases, or TypeScript syntax. If `.jsx` becomes unavoidable for Fresh ergonomics, return for an explicit design
  decision before proceeding.
- Dependency containment — keep UI dependencies under `src/ui/workspace/` as much as practical so the CLI core remains
  understandable and CI can check both the core and Workspace surfaces.
- Future collaboration — do not add a local database now, but keep REST resource shapes and URLs compatible with future
  project-scoped hosted/self-hosted routes and encrypted remote storage.
=======
- Fresh/Vite packaging — hydrated islands require the Fresh Vite pipeline. The implementation should avoid the direct
  `App.listen()` shortcut that the prototype found insufficient.
- Dependency containment — keep UI dependencies under `src/ui/workspace/` as much as practical so the CLI core remains
  understandable and CI can check both the core and Workspace surfaces.
- JavaScript strictness — all executable code must be `.js`/`.jsx` with JSDoc. Do not add `.ts`, interfaces, or
  TypeScript syntax.
- Future collaboration — do not add a local database now, but keep REST resource shapes and URLs compatible with future
  project-scoped hosted/self-hosted routes and encrypted remote storage.

## Tasks

| Task | Assignee | Dependencies | Write Scope                                                                                                                                                            | Description                                                                                                           |
| ---- | -------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1    | engineer | none         | src/plan-store.js, src/plan-store.test.js, src/ui/workspace                                                                                                            | Add durable Plan resource identity and a local REST API that can list, read, and body-save canonical Plans safely.    |
| 2    | engineer | 1            | src/cmd/plans/index.js, src/cmd/plans/ui.js, src/cmd/plans/index.test.js, src/cmd/registry.js, src/constants.js, src/ui/workspace, deno.json, README.md, docs          | Ship `wld plans ui` as a secure launcher for a browser Plan Board that shows the current checkout's Plans.            |
| 3    | engineer | 2            | src/shared/workflow/plan-lifecycle.js, src/shared/workflow/plan-lifecycle.test.js, src/plan-store.js, src/plan-store.test.js, src/ui/workspace, docs/plan-lifecycle.md | Add lifecycle-safe board actions for manual movement, closure without verification, and on-hold status.               |
| 4    | engineer | 3            | src/plan-store.js, src/plan-store.test.js, src/ui/workspace, deno.json                                                                                                 | Add read-first Plan and Epic detail views with body-only markdown editing, draft recovery, and stale-save protection. |
| 5    | tester   | 1, 2, 3, 4   | none                                                                                                                                                                   | Integration Point: run `deno task ci`, the Workspace validation commands, and report failures explicitly.             |

### Slice Details

#### Task 1 — Canonical Plan Resources and API

**What to build**

Create the first end-to-end resource path from canonical markdown Plan files to local Workspace API responses and safe
body persistence. Existing Plans should gain stable `planId` front matter idempotently, API callers should be able to
list hierarchy and read a Plan by durable ID, and body saves should preserve front matter while rejecting stale writes.
This slice is demoable without the full browser board by exercising the REST/JSON API and inspecting the unchanged Plan
body/front matter semantics on disk.

**Acceptance criteria**

- [ ] Existing Plans without `planId` receive globally unique IDs through an idempotent backfill path; existing IDs are
      preserved and duplicate IDs fail loudly.
- [ ] The local API can list Plans using the same Epic, child FEATURE, standalone, and orphan grouping semantics as
      `wld plans`.
- [ ] The local API can read a Plan by `planId` and returns both durable identity and canonical `planName`/path metadata
      needed by the UI.
- [ ] Body-only saves preserve all front matter fields, update only intended metadata such as timestamps, and reject
      stale saves when the stored body changed after the caller read it.
- [ ] Automated tests cover identity creation, collision handling, hierarchy grouping, read-by-ID, body preservation,
      and stale-save rejection.

#### Task 2 — Secure Launchable Plan Board

**What to build**

Ship a visible browser entry point for the local Plan Workspace. `wld plans` must keep its existing list behavior, while
`wld plans ui` starts the Workspace server for the current checkout, protects state-changing requests with a random
session token, defaults to loopback binding, and renders a custom RunWeild-owned Plan Board from the Task 1 API. The
board should make active, closed, and on-hold Plan areas visible enough to prove the Workspace shell and routing model.
Because this introduces a user-facing command and flags, use the **documentation** skill for README/docs updates.

**Acceptance criteria**

- [ ] `wld plans` still lists Plans with the current terminal behavior, and `wld plans ui --help` documents the UI
      subcommand and flags.
- [ ] `wld plans ui` binds to `127.0.0.1` by default, supports an explicit bind override, creates a random session
      token, prints or opens the browser URL, and shuts down cleanly.
- [ ] State-changing API requests without the session token are rejected, permissive CORS is not enabled, and file
      access is sandboxed to the launched checkout.
- [ ] The browser board renders Plan cards grouped by lifecycle visibility using API data, including Epic-tagged cards
      with child progress summaries.
- [ ] Workspace/Fresh/Vite/UnoCSS/Preact setup is JavaScript/JSDoc-only and is covered by Workspace check/test tasks
      plus root CI integration as appropriate.
- [ ] README or relevant docs explain how to launch the Plan UI, what `--bind` means, and that v1 is local/plaintext
      over the current checkout.

#### Task 3 — Lifecycle-Safe Board Actions

**What to build**

Make the board capable of changing Plan lifecycle state without raw YAML mutation. Extend the central Plan Lifecycle
module and Plan front matter normalization for manual board actions, `closed_without_verification`, and `on_hold`
semantics, then connect those transitions to the Workspace API and board controls. The user should be able to perform
allowed manual moves from the browser and see the Plan file reflect a lifecycle event outcome, while blocked moves
explain why they are not allowed. Because this changes user-facing lifecycle semantics, use the **documentation** skill
for lifecycle documentation updates.

**Acceptance criteria**

- [ ] `closed_without_verification` is a terminal manual status distinct from `verified`, and FEATURE Plans cannot
      become `verified` through board movement.
- [ ] Manual status movement is limited to safe non-terminal transitions and cannot casually enter or leave `failed`,
      bypass recovery, imply Workflow Validation, or hide merge/validation failure state.
- [ ] `on_hold`, hold metadata, hold resume, and hold reset behavior follow the on-hold PRD semantics; holding an Epic
      does not mutate child statuses.
- [ ] Board actions call lifecycle/API helpers rather than directly editing front matter, and API responses return clear
      success or blocked-transition errors.
- [ ] The board updates active, closed, and on-hold visibility after actions, including manual closure and hold/resume
      flows.
- [ ] Lifecycle tests cover allowed transitions, blocked direct verification, blocked failed-state movement, hold
      metadata, resume/reset metadata clearing, and Epic/child hold behavior.
- [ ] `docs/plan-lifecycle.md` documents the new statuses/events and preserves the invariant that workflow code records
      Plan Events instead of direct status mutation.

#### Task 4 — Plan and Epic Details with Body-Only Editing

**What to build**

Add the detail and editing experience that makes the board useful for real Plan work. Clicking a non-Epic card should
open a read-first Plan detail view with rendered markdown, front matter/worktree/dependency summaries, and a deliberate
Edit action. Editing should use a CodeMirror-style markdown source editor for the Plan body only, save explicitly
through the safe API, and preserve browser-local unsaved drafts across refreshes. Clicking an Epic should open an Epic
detail view that summarizes and links child FEATURE Plans without flattening them onto the main board.

**Acceptance criteria**

- [ ] Stable `planId` URLs open read-first detail views and continue to resolve after browser refreshes and server
      restarts.
- [ ] Plan detail renders markdown clearly and displays summary metadata such as classification, complexity, status,
      parent/dependencies, affected paths, and worktree state.
- [ ] The editor modifies only the markdown body, requires explicit Save, and cannot expose raw front matter editing as
      the default path.
- [ ] Unsaved editor changes are recoverable from browser-local draft storage after refresh, while canonical Plan files
      remain unchanged until Save.
- [ ] Saving through the editor preserves front matter and reports stale-save conflicts instead of silently overwriting
      external disk edits.
- [ ] Epic detail shows child FEATURE progress, child statuses, dependencies, held/failed children, and orphan behavior
      consistent with the board/listing semantics.
- [ ] Browser and/or API tests cover detail routing, body save, draft recovery behavior where practical, stale-save
      conflicts, and Epic detail data.
>>>>>>> runweild/worktree/automatic-session-names-terminal-titles-c8587348
