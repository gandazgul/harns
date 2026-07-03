---
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Record each execution worktree's source branch in durable plan metadata and merge validated worktree branches back into that recorded branch instead of whatever primary checkout branch is current."
affectedPaths:
    - "src/shared/worktree.js"
    - "src/shared/worktree-registry.js"
    - "src/plan-store.js"
    - "src/shared/workflow/workflow.js"
    - "src/shared/session/session-state.js"
    - "src/shared/workflow/plan-lifecycle.js"
    - "src/shared/workflow/validation.js"
    - "src/cmd/load-plan/index.js"
    - "src/shared/worktree.test.js"
    - "src/plan-store.test.js"
    - "src/shared/workflow/plan-lifecycle.test.js"
    - "src/shared/workflow/validation.test.js"
    - "src/cmd/load-plan/index.test.js"
frontend: false
devServerCommand: null
devServerUrl: null
devServerHmr: null
createdAt: "2026-07-03T14:03:13-04:00"
status: "draft"
---

# Fix Worktree Merge Target Branch

## Context

Feature plan execution worktrees are created from the primary checkout's current `HEAD`, and `createExecutionWorktree()`
already records the current source branch as `baseBranch` in the local `.wld/worktrees.json` registry. However, plan
front matter only records the execution worktree branch/path/status, and merge-back currently runs
`git merge --no-ff <worktreeBranch>` in whatever branch the primary checkout is on at validation or manual recovery
time.

The intended behavior is: a worktree created from branch `feature-base` should merge its validated changes back into
`feature-base`, even if the primary checkout later moved to `main` or another branch. `main` should not be special or
hardcoded.

Product behavior checkpoint: this draft assumes RunWield should automatically switch the primary checkout to the
recorded target branch before merging and leave the checkout on that target branch after a successful merge. If the
target branch cannot be checked out safely, validation should fail into the existing recoverable merge-conflict/recovery
flow rather than silently merging into the current branch.

## Objective

Persist each execution worktree's source/target branch durably in plan metadata and thread that target branch through
validation and manual recovery so merge-back always targets the branch the worktree was created from.

## Approach

Add a `worktreeBaseBranch` (or similarly named) plan front matter field alongside `worktreeBranch`. Populate it from the
`baseBranch` already returned by `createExecutionWorktree()` and by reusable registry entries. Extend active execution
workflow state and recovery context to carry this target branch. Update merge-risk inspection and merge-back helpers to
accept an explicit `targetBranch`, verify it exists, switch/check against that branch, and run all `HEAD`-sensitive
diff/merge/rebase logic against the target branch rather than the caller's current checkout by accident.

Keep backward compatibility for older plans: when plan front matter lacks `worktreeBaseBranch`, recover it from the
registry entry's existing `baseBranch`; if neither source has it, keep current behavior only as an explicit fallback
with user-facing recovery messaging.

## Files to Modify

- `src/plan-store.js` — add `worktreeBaseBranch` to `PlanFrontMatter`, key ordering, front matter formatting, injection,
  parsing, and null-clearing behavior.
- `src/shared/workflow/plan-lifecycle.js` — include `worktreeBaseBranch` in plan event details, persist it during
  `execution_started`/`recovery_reset`, and clear it when worktree metadata is cleared or abandoned.
- `src/shared/session/session-state.js` — add `worktreeBaseBranch` to active execution workflow state typing.
- `src/shared/workflow/workflow.js` — store `worktree.baseBranch` in active workflow state and in `execution_started`
  plan event details.
- `src/shared/worktree.js` — extend `inspectExecutionWorktreeMergeRisk()` and `mergeExecutionWorktree()` with an
  explicit target branch, and update merge logic so target branch, not incidental current `HEAD`, controls risk checks,
  staleness checks, plan-file conflict isolation, rebase target, and merge destination.
- `src/shared/worktree-registry.js` — keep existing `baseBranch` registry field; update JSDoc only if return/context
  types need clarification.
- `src/shared/workflow/validation.js` — read `worktreeBaseBranch` from active workflow and pass it to
  `mergeExecutionWorktree()`; improve system messages to name both execution branch and merge target branch.
- `src/cmd/load-plan/index.js` — resolve recovery context from plan metadata plus registry `baseBranch`, display target
  branch in recovery reports, pass target branch for manual merge, and preserve it when recreating/resetting worktrees.
- `src/shared/worktree.test.js` — add branch-targeting tests for create, inspect, and merge helpers.
- `src/plan-store.test.js` — update front matter round-trip/clear tests for `worktreeBaseBranch`.
- `src/shared/workflow/plan-lifecycle.test.js` — verify lifecycle events persist and clear `worktreeBaseBranch` with the
  rest of worktree metadata.
- `src/shared/workflow/validation.test.js` — verify validation passes the recorded target branch to merge-back and
  records recoverable failure metadata on target-branch checkout/merge failures.
- `src/cmd/load-plan/index.test.js` — verify manual recovery uses plan/registry base branch and includes the target
  branch in user-facing recovery output.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/shared/worktree.js:createExecutionWorktree()` — already captures `baseBranch`, `baseCommit`, `baseTree`, and
  `baseRef`; reuse this instead of inventing a second source of truth.
- `src/shared/worktree-registry.js` — registry entries already include `baseBranch`; use it as fallback for older plans
  whose front matter lacks the new field.
- `src/shared/workflow/plan-lifecycle.js:recordPlanEvent()` — continue using plan events to mutate execution/worktree
  metadata rather than direct ad hoc front matter edits.
- `src/plan-store.js:optionalFrontMatterValue()` — use the existing optional string/null-clearing front matter pattern.
- Existing worktree tests in `src/shared/worktree.test.js` — extend the existing temporary git repo fixtures instead of
  adding a new test harness.

## Implementation Steps

- [ ] Step 1: Add `worktreeBaseBranch` to plan metadata plumbing.
  - Update `PlanFrontMatter` JSDoc in `src/plan-store.js`.
  - Add the key to `PLAN_FRONT_MATTER_KEYS` after `worktreeBranch` or before it as a stable worktree metadata field.
  - Include it in `formatFrontMatter()`, `injectFrontMatter()`, and `parsePlanFrontMatter()` using optional
    string/null-clearing semantics.
  - Extend `src/plan-store.test.js` worktree front matter round-trip test to assert the field persists and clears.

- [ ] Step 2: Thread the target branch through lifecycle and active workflow state.
  - Add `worktreeBaseBranch` to active workflow JSDoc in `src/shared/session/session-state.js`.
  - In `startActiveExecutionWorkflow()`, set `worktreeBaseBranch: worktree.baseBranch` for new and reusable worktrees.
  - Add `worktreeBaseBranch` to `execution_started` event details.
  - Update `PlanEventDetails` and `buildPlanEventUpdates()` so `execution_started` and `recovery_reset` persist it, and
    `validation_passed` cleanup, `hold_reset_to_draft`, and `review_reopened` clear it with the rest of worktree
    metadata.
  - Add/update lifecycle tests for persistence and clearing.

- [ ] Step 3: Make merge risk and merge-back target-branch aware.
  - Extend `inspectExecutionWorktreeMergeRisk({ projectRoot, branch, targetBranch, allowedDirtyPaths })`.
  - Verify both the execution branch and `targetBranch` exist when `targetBranch` is provided.
  - Compute branch-changed paths against `targetBranch...branch` instead of `HEAD...branch` when a target is provided.
  - Run merge-tree checks against `targetBranch` and `branch`, without mutating the checkout.
  - Extend `mergeExecutionWorktree({ projectRoot, branch, targetBranch, worktreePath, allowedDirtyPaths })`.
  - Before merge, commit dirty worktree changes as today.
  - If `targetBranch` is provided and the primary checkout is not on it, safely check out `targetBranch`; if checkout is
    blocked by dirty/conflicting files, throw a clear error so validation enters recovery instead of merging into the
    wrong branch.
  - After checkout, keep existing overlapping-dirty-path protections, but ensure comparisons are against the target
    branch.
  - Replace the misleading `"Align plan files with main..."` commit message with target-neutral wording.
  - Rework the staleness rebase to rebase the execution branch onto `targetBranch`; prefer running rebase in the
    execution worktree path when available so Git does not try to check out a branch already attached to a worktree.
  - Merge with `git merge --no-ff <worktreeBranch>` only after the primary checkout is confirmed to be on
    `targetBranch`.

- [ ] Step 4: Update validation merge-back flow.
  - Read `worktreeBaseBranch` from `getActiveExecutionWorkflow()`.
  - Pass `targetBranch: worktreeBaseBranch` to `mergeExecutionWorktree()`.
  - Update system messages from “into primary checkout” to include the target branch when known, e.g. “Merging validated
    worktree branch X into target branch Y.”
  - Ensure merge failures remain recoverable: registry status becomes `merge_conflict`, plan event remains
    `worktree_merge_failed`, and plan metadata retains both execution branch and target branch.

- [ ] Step 5: Update manual recovery flow.
  - Extend `resolveRecoveryWorktree()` context to include `baseBranch` from
    `plan.attrs.worktreeBaseBranch || entry?.baseBranch`.
  - Display `Worktree target: <baseBranch>` in `appendRecoveryReport()`.
  - Pass `targetBranch: worktreeContext.baseBranch` to manual `mergeExecutionWorktree()`.
  - On worktree recreation/reset, persist the recreated worktree's `baseBranch` into plan front matter.
  - If a recovered old plan has no target branch in plan metadata or registry, show a clear warning that merge target is
    unknown and current-checkout fallback is being used.

- [ ] Step 6: Add focused regression tests.
  - Create a temp repo with a non-main branch, create an execution worktree from that branch, switch the primary
    checkout elsewhere, merge with `targetBranch`, and assert the changes land on the recorded source branch rather than
    the incidental current branch.
  - Assert `inspectExecutionWorktreeMergeRisk()` uses `targetBranch` without mutating current checkout.
  - Assert missing/deleted target branch produces a clear failure and does not merge into current branch.
  - Assert validation and manual recovery pass `targetBranch` through dependency-injected merge functions.

## Verification Plan

- Automated:
  `deno test -A src/shared/worktree.test.js src/plan-store.test.js src/shared/workflow/plan-lifecycle.test.js src/shared/workflow/validation.test.js src/cmd/load-plan/index.test.js`
- Automated: `deno task ci`
- Manual:
  - Create or use a non-main branch, approve/execute a feature plan from that branch, switch the primary checkout to
    another branch before validation merge-back, and confirm the plan's worktree branch merges into the recorded source
    branch, not the incidental current branch.
  - Repeat with the target branch missing or checkout blocked by dirty changes; confirm RunWield refuses to merge into
    the wrong branch and leaves the plan recoverable with clear metadata.
- Expected results:
  - New plan front matter records `worktreeBaseBranch` during execution and retains it through recoverable failures.
  - Successful merge-back targets the recorded source branch.
  - No code path hardcodes `main` as a worktree merge target.

## Edge Cases & Considerations

- Older in-flight plans may lack `worktreeBaseBranch`; recover from `.wld/worktrees.json` `baseBranch` when possible.
- The registry is local runtime state and should remain ignored/untracked; do not make `.wld/worktrees.json` part of
  durable branch-to-branch merge semantics beyond recovery fallback.
- If the recorded target branch has been deleted or renamed, fail clearly and keep the plan in recovery rather than
  guessing a target.
- If checking out the target branch would overwrite primary checkout dirty changes, fail clearly and keep the plan
  recoverable.
- Preserve pure JavaScript/JSDoc style; do not introduce TypeScript syntax.
- Open product assumption: automatic checkout to the recorded target branch during merge-back is desired, and the
  primary checkout may remain on that target branch after success.
