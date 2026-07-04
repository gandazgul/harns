---
planId: "74f315ce-700b-4f34-98d5-a10953a327cd"
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Implement CLI-only destructive unshare with maintainer authorization, confirmation, remote delete, local secret cleanup, and intentional local lock metadata clearing. Browser-side unshare/delete is explicitly deferred."
affectedPaths:
    - "src/cmd/plans/index.js"
    - "src/cmd/plans/unshare.js"
    - "src/cmd/plans/unshare.test.js"
    - "src/cmd/registry.js"
    - "src/plan-store.js"
    - "src/shared/collaboration/"
    - "src/ui/workspace/server/remote-adapter.js"
frontend: false
createdAt: "2026-07-04T14:52:22.904Z"
updatedAt: "2026-07-04T14:52:22.904Z"
status: "draft"
origin: "internal"
parentPlan: "collaborative-planning-remote-shared-spaces"
order: 8
dependencies:
    - "01-collaboration-protocol-crypto-and-secret-storage"
    - "02-shared-plan-lock-enforcement"
    - "03-remote-workspace-sqlite-shared-space-api"
    - "04-wld-plans-share-remote-publish-flow"
    - "07-wld-plans-push-remote-revision-publish-flow"
---

# `wld plans unshare` CLI Delete and Recovery

## Context

Unshare is destructive: it deletes the remote Shared Space and can strand other checkouts or browser sessions that still
have links. For v1, destructive unshare should remain CLI-only rather than adding browser delete controls.

Local Plans must not be silently edited when a remote is deleted elsewhere. The CLI should make local cleanup
intentional and recoverable where possible.

## Objective

Implement `wld plans unshare <plan-name-or-id>` with maintainer authorization, explicit confirmation, remote destructive
delete, local secret cleanup, local collaboration metadata clearing through the lock bypass, and helpful recovery
messaging for already-deleted/unavailable remotes.

## Approach

Add an `unshare` subcommand that resolves a local shared Plan, loads maintainer secrets, asks for confirmation unless
forced, calls the remote delete API, then intentionally removes local secret records and non-secret lock metadata. If
the remote is already deleted/unavailable, the command should distinguish between remote cleanup and local metadata
cleanup, using explicit flags or prompts so users do not accidentally unlock a Plan after a transient outage.

Do not implement browser-side delete controls in this slice.

## Files to Modify

- `src/cmd/plans/index.js` — dispatch the `unshare` subcommand.
- `src/cmd/plans/unshare.js` — implement argument parsing, confirmation, maintainer secret lookup, remote delete call,
  local cleanup, and output.
- `src/cmd/plans/unshare.test.js` — cover confirmation, force flag if added, wrong capability, missing secrets, deleted
  remote, transient network failure, local cleanup, and redaction.
- `src/cmd/registry.js` — update `wld help plans` usage examples and destructive warning text.
- `src/plan-store.js` — expose a controlled helper to clear collaboration lock metadata through the explicit bypass.
- `src/shared/collaboration/client.js` — add delete/unshare client method if not already present.
- `src/shared/collaboration/secrets.js` — add secret deletion helpers.
- `src/ui/workspace/server/remote-adapter.js` — ensure delete behavior is destructive and API responses are clear for
  deleted resources.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/cmd/plans/archive.js` — confirmation/force patterns if applicable.
- `src/cmd/plans/share.js` and `push.js` — shared Plan resolution, secret lookup, Plan Server URL precedence, and
  redacted output.
- `src/shared/collaboration/client.js` — maintainer bearer API calls.
- `src/plan-store.js` — collaboration bypass and front matter rewrite helpers.
- `src/shared/collaboration/secrets.js` — local secret-store update patterns.

## Implementation Steps

- [ ] Step 1: Add `unshare` dispatch and help text for
      `wld plans unshare <plan-name-or-id> [--plan-server=url] [--force]` if a force flag is selected.
- [ ] Step 2: Resolve the local shared Plan, verify it has maintainer secrets, and reject reviewer-only local secret
      records.
- [ ] Step 3: Present an explicit destructive confirmation describing remote deletion and other checkout/browser impact.
- [ ] Step 4: Call the remote delete API with maintainer authorization and handle success, already-deleted, wrong
      capability, and network failure distinctly.
- [ ] Step 5: On confirmed successful remote deletion, delete local collaboration secrets and clear non-secret
      collaboration front matter through the lock bypass.
- [ ] Step 6: For already-deleted remote state, require explicit user confirmation or flag before clearing local
      metadata/secrets.
- [ ] Step 7: Ensure pull/push commands and remote browser UI report deleted/broken collaboration state after unshare
      instead of silently editing local Plans.
- [ ] Step 8: Add tests that browser-side remote UI has no unshare/delete control in v1.
- [ ] Step 9: Run focused tests and the full project CI.

## Verification Plan

- Automated:
  `deno test -A src/cmd/plans/unshare.test.js src/shared/collaboration src/plan-store.test.js src/ui/workspace`
- Automated: `deno task ci`
- Manual: Share a Plan, then run `wld plans unshare <plan>` and confirm the destructive prompt. Verify the remote Shared
  Space is deleted, local secrets are removed, and local Plan lock metadata is cleared.
- Manual: Try old reviewer and maintainer URLs after unshare and verify they report deleted/not found states.
- Manual: Simulate a deleted remote before local cleanup and verify the command asks before clearing local metadata.
- Expected: unshare is CLI-only, destructive, maintainer-authorized, and never silently unlocks local Plans after
  ambiguous failures.

## Edge Cases & Considerations

- Network failure after a remote delete request may leave ambiguous state. Messaging should explain how to retry or
  verify before local cleanup.
- Other checkouts may remain locked with stale metadata; pull/push should guide those users toward deleted-remote
  recovery.
- Local cleanup should not remove the Plan body itself.
- Browser delete/unshare is intentionally deferred to reduce v1 capability-risk.
- Confirmation output must not print full maintainer secrets unless the user supplied them directly in the command.
