---
planId: "69a85422-96e5-46be-9042-078bf11129e7"
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Split Workspace server composition into local and remote modes, then add a SQLite-backed ciphertext-only Shared Space API for revisions, comments, resolve/reopen, capability checks, and delete. This slice is API/adapter focused and deliberately excludes browser review UX."
affectedPaths:
    - "deno.json"
    - "src/ui/workspace/server.js"
    - "src/ui/workspace/server/"
    - "src/ui/workspace/routes/"
    - "src/ui/workspace/workspace.test.js"
    - "src/shared/collaboration/"
frontend: false
createdAt: "2026-07-04T14:52:22.901Z"
updatedAt: "2026-07-04T14:52:22.901Z"
status: "draft"
origin: "internal"
parentPlan: "collaborative-planning-remote-shared-spaces"
order: 3
dependencies:
    - "01-collaboration-protocol-crypto-and-secret-storage"
---

# Remote Workspace SQLite Shared Space API

## Context

The current Workspace server is a checkout-local Fresh app that sets `ctx.state.cwd` and serves local Plan Board routes.
Remote collaboration needs a server mode that uses SQLite-backed Shared Spaces and must not inherit local filesystem
authority.

This slice proves the self-hosted backend path before CLI commands or browser review UI depend on it.

## Objective

Add a remote Workspace mode with SQLite schema/migrations and JSON APIs for Shared Space creation, revision
reads/writes, encrypted comment append/list, resolve/reopen, capability authorization, and destructive delete. Local
Workspace behavior must remain unchanged.

## Approach

Refactor `src/ui/workspace/server.js` into mode-aware app composition. Local mode continues to register the current Plan
Board routes with loopback token behavior and `ctx.state.cwd`. Remote mode registers only remote collaboration routes
and injects a SQLite-backed collaboration adapter into request state; it should not set `cwd` as an authority boundary.

Use a Workspace-owned database adapter with explicit migrations and transactional operations. Store only ciphertext and
minimal plaintext routing metadata: ids, timestamps, revision numbers, resolved flags, opaque anchors, status/deleted
state, and capability hashes.

## Files to Modify

- `deno.json` — add a SQLite dependency/import and any focused test task if needed.
- `src/ui/workspace/server.js` — add local vs remote mode composition while preserving the existing public local server
  API or adding compatibility wrappers.
- `src/ui/workspace/server/remote-db.js` — open SQLite, run migrations, and expose lifecycle-safe database handles.
- `src/ui/workspace/server/remote-schema.js` — define migration SQL for shared spaces, revisions, comments, capability
  hashes, status/deleted state, and indexes.
- `src/ui/workspace/server/remote-adapter.js` — implement Shared Space create/read, revision append/read/list, comment
  append/list, resolve/reopen, close/delete operations, and capability verification.
- `src/ui/workspace/routes/remote-api.js` — route handlers for remote JSON APIs using the shared protocol payload names.
- `src/ui/workspace/workspace.test.js` or new remote API tests — cover local mode unchanged and remote mode API
  behavior.
- `src/shared/collaboration/protocol.js` — refine payload validation if API implementation reveals missing fields.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/ui/workspace/server.js` — Fresh `App` composition, static asset handling, wrappers, and route registration style.
- `src/ui/workspace/routes/api/handlers.js` — JSON response/error conventions, while keeping local Plan APIs local-only.
- `src/shared/collaboration/capabilities.js` — capability hashing and redaction.
- `src/shared/collaboration/protocol.js` — payload typedefs and validation helpers.
- `../chores-app/src/utils/db.js` — simple Deno/SQLite precedent; use as inspiration only, with explicit Workspace
  migrations.

## Implementation Steps

- [ ] Step 1: Add a SQLite dependency compatible with Deno and this repository's pure JavaScript/JSDoc policy.
- [ ] Step 2: Refactor Workspace app creation to accept `{ mode: "local" | "remote" }` or equivalent, preserving
      existing `createWorkspaceApp({ cwd, token })` local behavior for `wld plans ui`.
- [ ] Step 3: Ensure remote mode does not set `ctx.state.cwd` or register local Plan Board mutation APIs.
- [ ] Step 4: Add SQLite migration code with schema for shared spaces, revisions, comments, and capability hashes using
      foreign keys/cascade delete.
- [ ] Step 5: Implement adapter operations for create Shared Space, append revision, list metadata, read encrypted
      revision blob, append encrypted comment, list comments, resolve/reopen comment, mark closed/deleted, and
      destructive delete.
- [ ] Step 6: Implement route handlers with bearer capability authorization and structured JSON error responses for
      wrong capability, missing resource, closed/deleted resource, and invalid payloads.
- [ ] Step 7: Add tests proving all stored semantic content fields are ciphertext strings and that plaintext
      comments/Plan bodies are never accepted by adapter tests.
- [ ] Step 8: Add tests proving local Workspace routes still work in local mode and are unavailable in remote mode.
- [ ] Step 9: Run focused tests and the full project CI.

## Verification Plan

- Automated: `deno test -A src/ui/workspace src/shared/collaboration`
- Automated: `deno task ci`
- Manual: Start a remote-mode Workspace server against a temporary SQLite file, create a Shared Space through the API,
  append a revision, append/list comments, resolve/reopen a comment, and delete the space.
- Manual: Inspect the SQLite database and verify Plan bodies, comment bodies, author names, anchors, original text, and
  context are stored only as ciphertext/opaque encrypted payloads.
- Expected: reviewer capability can read/comment/resolve/reopen but cannot append revisions or delete; maintainer
  capability can append revisions and delete; deleted resources return a clear deleted/not found state.

## Edge Cases & Considerations

- Remote mode must not accidentally expose local Plan files, local settings, or local Workspace routes.
- SQLite operations that update multiple tables should be transactional.
- Deletion is destructive by design, but later CLI slices must surface confirmation before calling it.
- Capability hashes are plaintext metadata but bearer values are not stored.
- D1/Cloudflare compatibility is a future follow-up; avoid SQLite choices that make later prepared-statement/batch
  adaptation impossible, but do not implement D1 here.
