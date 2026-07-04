---
planId: "6134699d-c22f-47c0-8ccc-79543c40df9c"
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Add non-secret collaboration front matter and enforce the remote-canonical Shared Plan Lock across normal Plan writes, lifecycle changes, local review rewrites, and local Workspace edits. Collaboration command bypasses are explicit and test-covered but not yet wired to real share/pull/push commands."
affectedPaths:
    - "src/plan-store.js"
    - "src/plan-store.test.js"
    - "src/shared/workflow/plan-lifecycle.js"
    - "src/shared/workflow/plan-lifecycle.test.js"
    - "src/shared/workflow/submit-plan.js"
    - "src/shared/workflow/submit-plan.test.js"
    - "src/ui/workspace/server/plan-adapter.js"
    - "src/ui/workspace/workspace.test.js"
    - "src/shared/collaboration/"
frontend: false
createdAt: "2026-07-04T14:52:22.901Z"
updatedAt: "2026-07-04T14:52:22.901Z"
status: "draft"
origin: "internal"
parentPlan: "collaborative-planning-remote-shared-spaces"
order: 2
dependencies:
    - "01-collaboration-protocol-crypto-and-secret-storage"
---

# Shared Plan Lock Enforcement

## Context

The Epic's core invariant is that a shared Plan is remote-canonical while shared. RunWield cannot prevent a user from
editing markdown in an external editor, but RunWield must prevent its own normal Plan mutations from silently changing a
shared Plan outside controlled collaboration flows.

Existing write seams are concentrated in `src/plan-store.js`, lifecycle helpers, local Plannotator review submit, and
the Workspace plan adapter. This slice adds the lock there before any CLI share/pull/push flow is exposed.

## Objective

Add non-secret collaboration metadata to Plan front matter and enforce a hard Shared Plan Lock for normal RunWield
writes. Provide explicit collaboration bypass options for future `share`, `pull`, `push`, and `unshare` flows, and make
blocked errors actionable.

## Approach

Represent shared state in Plan front matter using non-secret metadata only, such as remote server URL, remote Shared
Space id, latest remote revision number, last known body hash, and lock status. Add centralized lock detection and
assertion helpers in `plan-store` or `src/shared/collaboration/lock.js`, then call them from body writes, status/front
matter updates, lifecycle events, local review submit, and Workspace edit/lifecycle APIs.

Bypasses must be explicit, narrowly named, and available only to trusted collaboration command paths. They should still
update body hashes/revision metadata so later pull/push slices can detect local divergence.

## Files to Modify

- `src/plan-store.js` — parse/format collaboration front matter fields, add lock helpers, enforce lock checks on
  `savePlanBodyById`, `updatePlanStatus`, `updatePlanFrontMatter`, and any other normal write path.
- `src/plan-store.test.js` — cover locked body writes, status updates, front matter updates, child plan writes, body
  hash preservation, and explicit bypass behavior.
- `src/shared/collaboration/lock.js` — optional shared lock helper module for lock detection, error messages, and bypass
  option naming.
- `src/shared/workflow/plan-lifecycle.js` — ensure `recordPlanEvent` and lifecycle transitions respect lock failures and
  surface collaboration-specific recovery guidance.
- `src/shared/workflow/plan-lifecycle.test.js` — cover blocked lifecycle/status mutations for shared Plans.
- `src/shared/workflow/submit-plan.js` — block local Plannotator review rewrites for shared remote-canonical Plans
  unless a future collaboration bypass is passed.
- `src/shared/workflow/submit-plan.test.js` — cover locked review submit behavior without starting a browser review
  server.
- `src/ui/workspace/server/plan-adapter.js` — make local Workspace body edits and lifecycle actions return lock-aware
  blocked responses.
- `src/ui/workspace/routes/api/handlers.js` — preserve existing status codes while returning actionable lock messages.
- `src/ui/workspace/workspace.test.js` — cover Workspace API blocked responses for locked Plans.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/plan-store.js` — `parsePlanFrontMatter`, `injectFrontMatter`, `splitPlanMarkdownBody`, `hashPlanBody`,
  `savePlanBodyById`, and front matter normalization patterns.
- `src/shared/workflow/plan-lifecycle.js` — current status/event semantics; lock enforcement should not invent parallel
  lifecycle state.
- `src/ui/workspace/server/plan-adapter.js` — existing Workspace serialization and blocked-action response shape.
- `src/shared/collaboration/capabilities.js` — redaction helpers for messages if lock metadata includes remote URLs.

## Implementation Steps

- [ ] Step 1: Define non-secret collaboration front matter fields and add them to parsing/formatting in
      `src/plan-store.js`, keeping content keys and bearer capabilities out of front matter.
- [ ] Step 2: Add a `SharedPlanLockError` and helpers to detect active remote-canonical shared state from parsed front
      matter.
- [ ] Step 3: Update `savePlanBodyById`, `updatePlanStatus`, and `updatePlanFrontMatter` to assert the lock unless an
      explicit collaboration bypass option is supplied.
- [ ] Step 4: Add trusted bypass option names that include the collaboration action purpose, and ensure tests prove
      generic callers cannot accidentally bypass by passing arbitrary truthy values.
- [ ] Step 5: Update `recordPlanEvent` and lifecycle callers so locked Plans produce messages like "pull, push, or
      unshare this shared Plan first" instead of generic write failures.
- [ ] Step 6: Update `submitPlanForReview` so local Plannotator review cannot rewrite front matter or status for a
      locked shared Plan.
- [ ] Step 7: Update Workspace body edit and lifecycle APIs to return lock-aware `409` responses with no local file
      mutation.
- [ ] Step 8: Add tests for external-editor divergence detection inputs: locked front matter should retain last known
      body hash/revision metadata for future pull/push slices.
- [ ] Step 9: Run focused tests and the full project CI.

## Verification Plan

- Automated:
  `deno test -A src/plan-store.test.js src/shared/workflow/plan-lifecycle.test.js src/shared/workflow/submit-plan.test.js src/ui/workspace/workspace.test.js`
- Automated: `deno task ci`
- Manual: Create a Plan fixture with shared remote metadata, then try normal Plan body edit, lifecycle status change,
  and local review submit paths; each should fail with a collaboration-specific message and preserve file bytes.
- Manual: Use a test-only collaboration bypass path to update body/revision metadata and verify body hash metadata
  changes intentionally.
- Expected: locked Plans cannot be mutated by normal RunWield flows, but future collaboration commands have a narrow,
  auditable path for controlled writes.

## Edge Cases & Considerations

- RunWield cannot stop external text-editor edits. This slice should preserve metadata needed for later divergence
  checks rather than pretending filesystem edits are impossible.
- Front matter must never include content keys, bearer capabilities, full reviewer URLs, or full maintainer URLs.
- Existing Plans without collaboration metadata must behave exactly as before.
- Epic Plans and child FEATURE Plans may both be shareable; lock helpers should not assume only one classification.
- Error text should be actionable but not leak secret material.
