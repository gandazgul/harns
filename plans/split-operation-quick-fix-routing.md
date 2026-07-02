---
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Split OPERATION from QUICK_FIX routing and add no-plan Engineer mechanical validation."
affectedPaths:
    - "src/constants.js"
    - "src/tools/triage-report.js"
    - "src/agent-definitions/router.md"
    - "src/agent-definitions/operator.md"
    - "src/agent-definitions/engineer.md"
    - "src/shared/workflow/orchestrator.js"
    - "src/shared/workflow/validation.js"
    - "docs/workflows.md"
frontend: false
devServerCommand: null
devServerUrl: null
devServerHmr: null
createdAt: "2026-07-02T14:05:13-04:00"
status: "draft"
---

# Split OPERATION and QUICK_FIX Routing

## Context

`QUICK_FIX` currently mixes direct operational work with small code changes and routes both to Operator. The new domain
model separates non-code operations from bounded no-plan code implementation so execution ownership and validation match
the risk profile.

Resolved decisions:

- `OPERATION` becomes a distinct Routing Intent enum value.
- `OPERATION` routes to Operator for direct repository/environment operations.
- `QUICK_FIX` routes to Engineer for bounded code implementation with no Plan file.
- `QUICK_FIX` runs Mechanical Validation after `task_completed`: local CI/configured validation, repair by Engineer,
  capped at three total repair attempts.
- `QUICK_FIX` does not run Reviewer/semantic review because there is no Plan to compare against.
- Dependency upgrades may start as `OPERATION` only when explicitly requested; if CI fails or code edits are required,
  Operator returns to Router with concise context for fresh Triage.

## Objective

Update routing, agent definitions, workflow dispatch, validation behavior, docs, and tests so RunWield supports the new
six-intent routing model:

`INQUIRY`, `IDEATION`, `OPERATION`, `QUICK_FIX`, `FEATURE`, `PROJECT`.

## Approach

Add `OPERATION` to the canonical Routing Intent list and update Router guidance so operational work routes to Operator
while small code changes route to Engineer. Split the current `QUICK_FIX` dispatch path in the orchestrator into two
direct-execution paths:

- `OPERATION`: existing Operator direct execution with self-verification only.
- `QUICK_FIX`: Engineer direct execution followed by a new no-plan Mechanical Validation loop.

Reuse the existing local CI runner and repair-session mechanics from Workflow Validation, but keep the new loop separate
from Plan lifecycle, worktree merge-back, Reviewer, Plannotator code review, and Plan Events.

## Files to Modify

- `src/constants.js` — add `OPERATION` to `ROUTING_INTENTS` in the agreed order.
- `src/tools/triage-report.js` — update tool descriptions and affected-path guidance for `OPERATION` vs `QUICK_FIX`;
  preserve Plan Classification behavior only for `FEATURE`/`PROJECT`.
- `src/agent-definitions/router.md` — define `OPERATION`, redefine `QUICK_FIX`, add uncertainty rules, and update
  dependency-upgrade escalation guidance.
- `src/agent-definitions/operator.md` — narrow Operator scope to operations; add dependency-upgrade mini-flow and
  return-to-Router escalation rules.
- `src/agent-definitions/engineer.md` — allow direct `QUICK_FIX` execution in addition to approved Plan execution;
  clarify no-plan Mechanical Validation expectations.
- `src/shared/workflow/orchestrator.js` — route `OPERATION` to Operator and `QUICK_FIX` to Engineer; invoke Mechanical
  Validation after completed quick fixes.
- `src/shared/workflow/validation.js` — extract or add a no-plan Mechanical Validation loop that runs local CI, sends
  failures to Engineer, caps at three total repair attempts, and returns a clear pass/fail result.
- `docs/workflows.md`, `docs/usage.md`, `docs/index.md`, `README.md`, `docs/plan-lifecycle.md`, `CONTEXT.md` — align
  public workflow language with the new intents and validation split.
- `scripts/router-eval-utils.js` and router-eval tests — update routing order, materializing intent sets, disagreement
  labels, and examples.
- Relevant tests under `src/tools/__tests__/`, `src/shared/workflow/*.test.js`, and `scripts/*.test.js` — update
  expectations and add coverage for both direct routes.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/shared/workflow/validation.js` — reuse `runLocalCI` and existing repair-session pattern, but avoid Plan-specific
  semantic review and lifecycle updates.
- `src/shared/workflow/orchestrator.js` — reuse existing direct `QUICK_FIX` dispatch shape for the new `OPERATION`
  route.
- `src/shared/workflow/workflow.js` — reuse `readLatestTaskCompletedOutcome` and existing task completion handling.
- `src/tools/triage-report.js` — reuse normalization pattern that keeps `classification` only for Plan-producing
  intents.
- `scripts/router-eval-utils.js` — reuse existing distance/disagreement helpers and extend them to the six-intent order.

## Implementation Steps

- [ ] Step 1: Update canonical Routing Intent data and JSDoc unions to include `OPERATION` in the order `INQUIRY`,
      `IDEATION`, `OPERATION`, `QUICK_FIX`, `FEATURE`, `PROJECT`.
- [ ] Step 2: Update `triage_report` descriptions and normalization tests so `OPERATION` is accepted and does not
      produce Plan Classification metadata.
- [ ] Step 3: Revise Router instructions: `OPERATION` is non-code direct work; `QUICK_FIX` is bounded no-plan code work;
      uncertainty biases are `OPERATION -> QUICK_FIX -> FEATURE`.
- [ ] Step 4: Revise Operator instructions: remove small coding ownership, keep operations, add dependency-upgrade
      mini-flow, and require concise `return_to_router` scope escalation when CI/code changes exceed operation scope.
- [ ] Step 5: Revise Engineer instructions to accept direct `QUICK_FIX` prompts and to expect external Mechanical
      Validation after `task_completed`.
- [ ] Step 6: Split orchestrator dispatch: `OPERATION` runs Operator and warns if no `task_completed`; `QUICK_FIX` runs
      Engineer and, on completion, starts Mechanical Validation.
- [ ] Step 7: Implement Mechanical Validation as a no-plan loop: run local CI/configured validation, send failures to
      Engineer, repeat up to three total repair attempts, then pass or stop with a failure summary while leaving
      Engineer active.
- [ ] Step 8: Ensure Mechanical Validation does not record Plan Events, mutate Plan Status, run Reviewer, run
      Plannotator code review, require implementation diff checks, or perform worktree merge-back.
- [ ] Step 9: Update workflow, usage, index, README, plan lifecycle, and context docs to reflect OPERATION, QUICK_FIX,
      Mechanical Validation, and Scope Escalation semantics.
- [ ] Step 10: Update router-eval scripts/tests and workflow/tool tests for the new enum, routing order,
      no-classification behavior, OPERATION dispatch, QUICK_FIX Engineer dispatch, validation success, validation
      repair, and validation cap failure.

## Verification Plan

- Automated: `deno task ci`
- Targeted tests before full CI when useful:
  - `deno test src/tools/__tests__/triage-report.test.js`
  - `deno test src/shared/workflow/orchestrator.test.js src/shared/workflow/validation.test.js`
  - `deno test scripts/router-eval-utils.test.js scripts/curate-router-judgement-csv.test.js scripts/evaluate-router-judgements.test.js scripts/run-router-golden-set.test.js`
- Expected results:
  - `OPERATION` is accepted by `triage_report` and does not set `classification`.
  - `QUICK_FIX` still does not set `classification`.
  - Router docs prefer `QUICK_FIX` over `OPERATION` when code risk is unclear, and `FEATURE` over `QUICK_FIX` when
    planning risk is unclear.
  - `OPERATION` dispatches to Operator and ends after Operator `task_completed` without RunWield validation.
  - `QUICK_FIX` dispatches to Engineer, runs Mechanical Validation after Engineer `task_completed`, sends CI failures
    back to Engineer, and stops after three total failed repair attempts.
  - No Reviewer session is started for `QUICK_FIX` Mechanical Validation.

## Edge Cases & Considerations

- Legacy records/tests may still use `classification: "QUICK_FIX"`; preserve backward normalization only where already
  supported, but do not create new Plan Classification behavior for `QUICK_FIX` or `OPERATION`.
- Existing memories/docs that say `QUICK_FIX -> Operator` are obsolete; docs should consistently say
  `OPERATION -> Operator`, `QUICK_FIX -> Engineer`.
- Dependency upgrades are risky even as operations; Operator should trust explicit user requests but must escalate via
  Router as soon as CI shows required code changes.
- Mechanical Validation failure is not Plan failure; it should report failure and leave Engineer active for manual
  follow-up rather than recording Plan lifecycle state.
