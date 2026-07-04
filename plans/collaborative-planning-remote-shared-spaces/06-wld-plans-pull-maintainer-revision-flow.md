---
planId: "6cd5249e-32ca-4288-b5fe-ed94c38aefbd"
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Implement maintainer pull by URL or known plan id, including secret import, remote revision/comment decrypt, local divergence checks, controlled local update, and Planner/Architect launch with decrypted review context. This slice is where remote feedback enters the planning agent workflow."
affectedPaths:
    - "src/cmd/plans/index.js"
    - "src/cmd/plans/pull.js"
    - "src/cmd/plans/pull.test.js"
    - "src/shared/session/agent-handler.js"
    - "src/shared/workflow/"
    - "src/plan-store.js"
    - "src/shared/collaboration/"
frontend: false
createdAt: "2026-07-04T14:52:22.903Z"
updatedAt: "2026-07-04T14:52:22.903Z"
status: "draft"
origin: "internal"
parentPlan: "collaborative-planning-remote-shared-spaces"
order: 6
dependencies:
    - "01-collaboration-protocol-crypto-and-secret-storage"
    - "02-shared-plan-lock-enforcement"
    - "03-remote-workspace-sqlite-shared-space-api"
    - "04-wld-plans-share-remote-publish-flow"
---

# `wld plans pull` Maintainer Revision Flow

## Context

Collaborative Planning requires a maintainer to pull remote revisions and reviewer comments into a checkout, then use
Planner or Architect to incorporate feedback. Maintainer handoff must work without accounts: a maintainer URL should
bootstrap local secrets, while a known local plan id should use already-imported secrets.

This flow must respect the Shared Plan Lock and avoid exposing bearer capabilities to the planning agent unless strictly
required by the command wrapper.

## Objective

Implement `wld plans pull` so it can accept a maintainer URL or a local Plan id/name, fetch and decrypt the latest
remote revision and comments, detect local divergence, update local Plan state through a controlled collaboration path
when safe, and launch the appropriate planning agent with decrypted revision/comment context.

## Approach

Add a `pull` subcommand with two entry modes: maintainer URL bootstrap and local shared Plan lookup. The command
parses/imports secrets, fetches remote metadata/revisions/comments, decrypts semantic content, compares remote
revision/body hash with local collaboration metadata, and either updates local Plan markdown through the lock bypass or
stops with recovery guidance.

When feedback needs incorporation, route to Planner or Architect based on Plan classification/type, passing only the
decrypted Plan/comment context and explicit instructions to revise through the controlled collaboration flow. Keep
capability secrets in the command wrapper/secret store, not in general agent prompts.

## Files to Modify

- `src/cmd/plans/index.js` — dispatch the `pull` subcommand.
- `src/cmd/plans/pull.js` — implement argument parsing, maintainer URL import, secret lookup, remote fetch/decrypt,
  divergence checks, local update, and planning agent launch.
- `src/cmd/plans/pull.test.js` — cover URL bootstrap, known plan lookup, missing secrets, wrong capability, wrong key,
  deleted remote, divergence, agent-selection prompt context, and redaction.
- `src/shared/session/agent-handler.js` — add or expose a controlled way for the CLI flow to launch Planner/Architect
  with collaboration context.
- `src/shared/workflow/` — add any collaboration pull workflow helper that should not live in command parsing code.
- `src/plan-store.js` — expose controlled collaboration update helpers for local body/revision metadata writes.
- `src/shared/collaboration/client.js` — add remote metadata/revision/comment fetch methods if needed.
- `src/shared/collaboration/secrets.js` — support importing maintainer URL secrets and resolving stored secrets by plan
  id/remote id.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/cmd/plans/share.js` — argument parsing, Plan Server URL precedence, secret handling, and redacted output
  conventions from the share slice.
- `src/shared/collaboration/urls.js` — maintainer URL parsing.
- `src/shared/collaboration/crypto.js` — revision/comment decryption.
- `src/plan-store.js` — lock bypass and body hash helpers.
- `src/shared/session/agent-handler.js` — existing agent invocation/session flow.
- Project Decomposition behavior — Planner for FEATURE/quick plans, Architect/Slicer-aware context for PROJECT Epics as
  appropriate.

## Implementation Steps

- [ ] Step 1: Add `pull` dispatch and help text for `wld plans pull <maintainer-url-or-plan-id> [--plan-server=url]`.
- [ ] Step 2: Implement maintainer URL parsing/import so a new checkout can store the content key and maintainer
      capability without accounts.
- [ ] Step 3: Implement local shared Plan lookup by plan id/name using stored secrets and non-secret front matter
      metadata.
- [ ] Step 4: Fetch remote Shared Space metadata, latest revision, and comments; handle wrong capability, deleted
      remote, closed remote, and missing revision states.
- [ ] Step 5: Decrypt revision/comment semantic content and normalize it into an agent-friendly review context.
- [ ] Step 6: Compare local collaboration metadata/body hash/revision number with remote state and block on unsafe
      divergence instead of overwriting silently.
- [ ] Step 7: When safe, update local Plan markdown and collaboration metadata through the explicit lock bypass.
- [ ] Step 8: Launch Planner or Architect with decrypted review context and instruction that revisions must remain
      within the collaboration pull/push flow.
- [ ] Step 9: Ensure bearer capabilities/content keys are not included in agent prompts, logs, or thrown errors.
- [ ] Step 10: Run focused tests and the full project CI.

## Verification Plan

- Automated: `deno test -A src/cmd/plans/pull.test.js src/shared/collaboration src/plan-store.test.js`
- Automated: `deno task ci`
- Manual: In checkout A, share a Plan; in checkout B, run `wld plans pull <maintainer-url>` and verify secrets import,
  local Plan creation/update, and planning agent launch context.
- Manual: Add reviewer comments remotely, pull again, and verify decrypted comments appear in the planning context while
  bearer secrets do not.
- Manual: Modify the local Plan file externally after share, then run pull and verify the command reports divergence
  instead of overwriting silently.
- Expected: maintainer handoff works accountlessly; safe pulls update local state through the lock bypass; unsafe pulls
  stop with recovery guidance.

## Edge Cases & Considerations

- Pull may be used before any local Plan exists in the checkout; decide whether to create a local Plan from remote
  metadata or require an explicit destination. Tests should lock the chosen behavior.
- PROJECT Epics should route to the planning workflow appropriate for Epic revision, not direct execution.
- Comment content may be large; keep prompts structured and concise enough for planning agents.
- Capability and key material must remain outside prompts unless a later explicit design requires otherwise.
- Deleted remote state should guide the user toward intentional local metadata cleanup, not automatic edits.
