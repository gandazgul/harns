---
planId: "8255da0d-5877-440d-ba67-9cb5d754b982"
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Add the reviewer-facing remote Shared Space UI for decrypting and reading revisions, adding encrypted comments with display names, resolving/reopening comments, and switching revisions. This is the main frontend slice and requires headed browser verification."
affectedPaths:
    - "src/ui/workspace/server.js"
    - "src/ui/workspace/routes/"
    - "src/ui/workspace/components/"
    - "src/ui/workspace/islands/"
    - "src/ui/workspace/static/styles.css"
    - "src/shared/collaboration/"
    - "src/ui/workspace/workspace.test.js"
frontend: true
devServerCommand: "deno task workspace:dev"
devServerUrl: "http://localhost:5173"
devServerHmr: true
createdAt: "2026-07-04T14:52:22.903Z"
updatedAt: "2026-07-04T14:52:22.903Z"
status: "draft"
origin: "internal"
parentPlan: "collaborative-planning-remote-shared-spaces"
order: 5
dependencies:
    - "01-collaboration-protocol-crypto-and-secret-storage"
    - "03-remote-workspace-sqlite-shared-space-api"
    - "04-wld-plans-share-remote-publish-flow"
---

# Remote Browser Review MVP

## Context

Collaborative Planning becomes useful when reviewers can open a browser link, read the shared Plan, and leave encrypted
feedback without installing RunWield or creating accounts. The existing Workspace UI has reusable shell, markdown
rendering, and style patterns, but remote review must run against remote Shared Space APIs and client-side decryption.

This slice deliberately keeps destructive unshare out of the browser. Unshare remains CLI-only for v1.

## Objective

Implement a remote reviewer UI at a route such as `/p/:planId` that loads encrypted revision data, decrypts it in the
browser using URL fragment material, renders markdown, captures a reviewer display name, creates/list encrypted
comments, resolves/reopens comments, and switches between revisions.

## Approach

Extend the existing Fresh Workspace app in remote mode with browser routes and islands specific to Shared Space review.
Reuse `MarkdownView`/Plan detail rendering where practical, but keep remote review data flow separate from local Plan
Board APIs. Use shared collaboration URL/crypto helpers where browser-compatible, or create small browser wrappers
around the same protocol.

Comments should encrypt semantic content client-side, including author/display name, body, anchors/original text/context
if present. Plaintext server-visible metadata remains limited to ids, revision numbers, timestamps, resolved flags, and
opaque encrypted/anchor identifiers.

## Files to Modify

- `src/ui/workspace/server.js` — register remote review routes only in remote mode.
- `src/ui/workspace/routes/remote-review.jsx` — render the remote Shared Space shell for `/p/:planId`.
- `src/ui/workspace/routes/remote-api.js` — ensure browser route/API paths align with remote adapter endpoints.
- `src/ui/workspace/components/MarkdownView.jsx` — reuse or lightly adapt markdown rendering for decrypted remote Plan
  content.
- `src/ui/workspace/components/PlanDetail.jsx` — reuse presentational pieces where helpful without coupling remote UI to
  local Plan files.
- `src/ui/workspace/islands/RemotePlanReview.jsx` — client island for fragment parsing, decrypting revisions/comments,
  display name capture, comment creation, resolve/reopen, and revision switching.
- `src/ui/workspace/static/styles.css` — style remote review layout, revision selector, comment sidebar/list, empty
  states, locked/closed/deleted states, and capability-specific controls.
- `src/shared/collaboration/crypto.js` and `src/shared/collaboration/urls.js` — ensure browser-safe exports or add
  browser-specific wrappers without duplicating protocol semantics.
- `src/ui/workspace/workspace.test.js` — add server-render/API contract tests for remote routes.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/ui/workspace/components/MarkdownView.jsx` — Plan markdown rendering.
- `src/ui/workspace/components/PlanDetail.jsx` — visual hierarchy and metadata presentation patterns.
- `src/ui/workspace/islands/PlanBodyEditor.jsx` or existing islands — fetch/error/loading state conventions.
- `src/ui/workspace/static/styles.css` — Workspace visual language and responsive layout.
- `../plannotator/packages/ui/utils/sharing.ts` and Plannotator UI concepts — comment UX inspiration; port/adapt
  concepts only where compatible.
- `src/shared/collaboration/urls.js` — URL fragment parsing and capability separation.

## Implementation Steps

- [ ] Step 1: Add a remote review route in Workspace remote mode for `/p/:planId` that renders a shell and does not
      require local Workspace token auth.
- [ ] Step 2: Implement a client island that parses reviewer or maintainer URL fragments, extracts content key material,
      and redacts secrets from any visible error states.
- [ ] Step 3: Fetch Shared Space metadata and latest revision ciphertext from remote APIs, decrypt in the browser, and
      render the Plan markdown.
- [ ] Step 4: Add a revision selector that loads/decrypts previous revisions; comments remain per-revision and do not
      carry forward.
- [ ] Step 5: Add display-name capture stored locally in browser storage or component state, then encrypt author/comment
      semantic content before submitting comments.
- [ ] Step 6: Add comment list loading/decryption for the active revision, with failure states for wrong key, tampered
      data, deleted remote, closed remote, and empty comments.
- [ ] Step 7: Add reviewer resolve/reopen controls that update resolved state through the API and refresh local comment
      state.
- [ ] Step 8: Add closed/deleted/locked UI states. Deleted/unavailable spaces should not imply local Plan edits; they
      simply explain the remote state.
- [ ] Step 9: Add styling for readable Plan content, comment sidebar/list, revision selector, mobile stacking, and
      capability-specific controls.
- [ ] Step 10: Add route/component tests where practical and perform headed browser verification.

## Verification Plan

- Automated: `deno test -A src/ui/workspace src/shared/collaboration`
- Automated: `deno task ci`
- Frontend: Start the Workspace dev server with `deno task workspace:dev` and open `http://localhost:5173` or the
  remote-mode test URL produced by the implementation.
- Frontend: In a headed browser, open a reviewer URL for a seeded Shared Space, verify the Plan decrypts and renders,
  enter a display name, add a comment, refresh, and verify the comment decrypts and persists.
- Frontend: Resolve and reopen the comment in the browser and verify resolved state updates without exposing plaintext
  in API payloads.
- Frontend: Switch from revision 2 to revision 1 and verify comments are scoped to the selected revision.
- Manual: Inspect network requests and SQLite rows to confirm Plan body, comment body, author/display name, and
  anchor/context semantic data are ciphertext only.
- Expected: reviewer capability can view/comment/resolve/reopen; no push or unshare control is available in the browser.

## Edge Cases & Considerations

- URL fragment data is not sent to the server by browsers; preserve that invariant when constructing fetch URLs.
- Wrong-key and tampered-ciphertext failures should be user-readable and should not leak ciphertext or secrets.
- Display names are semantic content and should be encrypted, not stored as plaintext metadata.
- Browser unshare/delete is explicitly out of scope for v1; destructive delete remains CLI-only.
- If shared crypto helpers rely on Deno-only APIs, add browser-compatible wrappers without diverging protocol behavior.
