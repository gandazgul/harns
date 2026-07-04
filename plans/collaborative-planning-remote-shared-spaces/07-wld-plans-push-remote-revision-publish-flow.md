---
planId: "7d46dba7-f029-4907-a8bf-293e1d75e1ce"
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Add the maintainer push command that encrypts the current controlled local revision, appends a new remote revision, updates local revision/body-hash metadata, and handles stale or divergent local/remote states safely. This completes the basic pull-revise-push collaboration loop."
affectedPaths:
    - "src/cmd/plans/index.js"
    - "src/cmd/plans/push.js"
    - "src/cmd/plans/push.test.js"
    - "src/plan-store.js"
    - "src/shared/collaboration/"
frontend: false
createdAt: "2026-07-04T14:52:22.904Z"
updatedAt: "2026-07-04T14:52:22.904Z"
status: "draft"
origin: "internal"
parentPlan: "collaborative-planning-remote-shared-spaces"
order: 7
dependencies:
    - "01-collaboration-protocol-crypto-and-secret-storage"
    - "02-shared-plan-lock-enforcement"
    - "03-remote-workspace-sqlite-shared-space-api"
    - "04-wld-plans-share-remote-publish-flow"
    - "06-wld-plans-pull-maintainer-revision-flow"
---

# `wld plans push` Remote Revision Publish Flow

## Context

After a maintainer pulls reviewer feedback and revises a Plan locally through the controlled workflow, the team needs a
new remote revision at the same Shared Space link. Comments should remain scoped to their original revision, and new
revisions should start without inherited comments.

Push must not blindly overwrite remote state or local divergence. It is the final step in the basic share → review →
pull → revise → push loop.

## Objective

Implement `wld plans push <plan-name-or-id>` so it validates local and remote collaboration state, encrypts the current
local Plan revision, appends a new remote revision with maintainer authorization, updates local non-secret
revision/body-hash metadata, and prints reviewer-facing next steps.

## Approach

Add a `push` subcommand using stored maintainer secrets and the shared API client. The command should fetch remote
metadata first, compare remote current revision with local last-known revision, compare local body hash with recorded
collaboration state, and only push when the local state is intentionally revised and remote state is not stale. After a
successful append, update local front matter through the collaboration bypass.

## Files to Modify

- `src/cmd/plans/index.js` — dispatch the `push` subcommand.
- `src/cmd/plans/push.js` — implement argument parsing, secret lookup, validation, encryption, remote revision append,
  metadata update, and output.
- `src/cmd/plans/push.test.js` — cover happy path, missing secrets, wrong capability, deleted remote, closed remote,
  stale remote revision, unchanged body, external local divergence, and redaction.
- `src/cmd/registry.js` — update `wld help plans` usage examples for `push`.
- `src/plan-store.js` — expose any helper needed to update remote revision/body hash metadata through the lock bypass.
- `src/shared/collaboration/client.js` — add append revision method if not already present.
- `src/shared/collaboration/crypto.js` — reuse encryption for pushed Plan payloads.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/cmd/plans/share.js` — encryption and initial publish conventions.
- `src/cmd/plans/pull.js` — secret lookup, remote metadata fetch, and divergence-check conventions.
- `src/shared/collaboration/client.js` — bearer-auth API calls and structured errors.
- `src/plan-store.js` — body hash helpers and controlled collaboration metadata update.
- `src/shared/collaboration/urls.js` — reconstruct reviewer URL output if useful without leaking maintainer secrets.

## Implementation Steps

- [ ] Step 1: Add `push` dispatch and help text for `wld plans push <plan-name-or-id> [--plan-server=url]`.
- [ ] Step 2: Resolve the local shared Plan and stored maintainer secrets; reject unshared Plans and reviewer-only
      secret records.
- [ ] Step 3: Fetch remote metadata and verify the remote current revision matches local last-known revision before
      pushing.
- [ ] Step 4: Compute current local body hash and compare with last pulled/pushed hash to distinguish unchanged Plans
      from intentionally revised Plans and unsafe external divergence.
- [ ] Step 5: Encrypt the current Plan payload with the existing content key and append a new remote revision using
      maintainer authorization.
- [ ] Step 6: Update local collaboration metadata through the lock bypass with new remote revision number and body hash.
- [ ] Step 7: Print a concise success message and reviewer URL or instructions to re-share the existing reviewer link,
      without printing maintainer secrets unnecessarily.
- [ ] Step 8: Handle closed/deleted remote states with actionable recovery messages.
- [ ] Step 9: Add tests for comments remaining associated with their original revisions and new revision metadata
      appearing in remote API responses.
- [ ] Step 10: Run focused tests and the full project CI.

## Verification Plan

- Automated: `deno test -A src/cmd/plans/push.test.js src/shared/collaboration src/plan-store.test.js src/ui/workspace`
- Automated: `deno task ci`
- Manual: Share a Plan, add reviewer comments, pull and revise locally, then run `wld plans push <plan>` and verify the
  remote Shared Space shows a new revision.
- Manual: Verify old comments remain on their original revision and the new revision starts with no inherited comments.
- Manual: Simulate a remote revision added elsewhere before push and verify the command blocks as stale instead of
  appending blindly.
- Expected: push only succeeds from a safe maintainer state and updates local non-secret metadata after remote append
  succeeds.

## Edge Cases & Considerations

- A no-op push should probably be blocked or require an explicit flag; v1 should avoid creating empty duplicate
  revisions by default.
- If remote append succeeds but local metadata update fails, the command must report recovery steps and avoid hiding the
  partial success.
- Local external edits are detectable only via body hash/revision metadata; messaging should be honest about that
  limitation.
- Maintainer capability leakage is high risk; do not print maintainer URLs as routine push output.
- Reviewer links should remain stable across revisions.
