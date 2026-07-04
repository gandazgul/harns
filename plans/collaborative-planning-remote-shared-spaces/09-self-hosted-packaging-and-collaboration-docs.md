---
planId: "03373eb8-8a1f-47a6-b944-d93a917ed942"
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Package the remote Workspace mode for self-hosted SQLite deployment and document setup, CLI collaboration workflows, privacy guarantees, secret handling, deleted-remote recovery, and the deferred Cloudflare/D1 follow-up. This final slice verifies the end-to-end self-hosted path."
affectedPaths:
    - "Dockerfile"
    - "docker-compose.yml"
    - "deno.json"
    - "docs/"
    - "docs/prd/collaborative-planning-PRD.md"
    - "docs/adr/008-remote-canonical-collaborative-shared-spaces.md"
    - "README.md"
frontend: false
createdAt: "2026-07-04T14:52:22.904Z"
updatedAt: "2026-07-04T14:52:22.904Z"
status: "draft"
origin: "internal"
parentPlan: "collaborative-planning-remote-shared-spaces"
order: 9
dependencies:
    - "05-remote-browser-review-mvp"
    - "06-wld-plans-pull-maintainer-revision-flow"
    - "07-wld-plans-push-remote-revision-publish-flow"
    - "08-wld-plans-unshare-cli-delete-and-recovery"
---

# Self-Hosted Packaging and Collaboration Docs

## Context

The Epic is self-hosted first: Docker + Fresh Workspace remote mode + SQLite. Once protocol, server, CLI, and browser
review flows exist, users need a repeatable deployment path and clear documentation for privacy, commands, recovery, and
operational limits.

Cloudflare/D1 hosted deployment remains deferred and should not be smuggled into this Epic.

## Objective

Add Docker/self-host packaging for remote Workspace mode with a SQLite volume, configuration environment variables,
startup documentation, CLI collaboration workflow documentation, privacy model notes, secret handling guidance,
deleted-remote recovery notes, and an end-to-end verification path.

## Approach

Create a container that runs the remote Workspace server mode without local checkout Plan authority. Add
`docker-compose.yml` for local self-host testing with a persistent SQLite volume and configurable public Plan Server
URL. Update docs to reflect the rehashed decisions: Shared Space terminology, remote-canonical lock,
`wld plans share|pull|push|unshare`, accountless bearer capabilities, CLI-only unshare in v1, self-hosted-first scope,
and D1/Cloudflare as a separate follow-up.

## Files to Modify

- `Dockerfile` — build/run the remote Workspace server mode with Deno permissions scoped as tightly as practical.
- `docker-compose.yml` — provide SQLite volume, port mapping, and environment variables for self-hosted local
  verification.
- `deno.json` — add a task for remote Workspace mode or Docker verification if needed.
- `docs/collaborative-planning.md` or similar — user-facing collaboration setup and workflow guide.
- `docs/prd/collaborative-planning-PRD.md` — update old terminology and resolved assumptions to match the rehashed
  self-hosted-first architecture.
- `docs/adr/008-remote-canonical-collaborative-shared-spaces.md` — refresh details if implementation decisions refined
  the ADR.
- `docs/usage.md`, `docs/workflows.md`, or `docs/index.md` — link to collaboration commands and setup docs.
- `README.md` — add a concise pointer to self-hosted collaborative planning if README conventions support it.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `deno task workspace:dev` and `src/ui/workspace/vite.config.js` — existing Workspace development conventions.
- `docs/prd/local-first-plan-management-ui-PRD.md` — Workspace terminology and local/remote boundary language.
- `docs/workflows.md` and `docs/usage.md` — command documentation style.
- `docs/adr/008-remote-canonical-collaborative-shared-spaces.md` — architectural decision language to keep docs
  consistent.
- Existing Docker/compile scripts if present in the repository; otherwise keep the container straightforward and
  Deno-native.

## Implementation Steps

- [ ] Step 1: Add or confirm a command/task that starts Workspace in remote SQLite mode with explicit database path,
      host, port, and public base URL settings.
- [ ] Step 2: Create a `Dockerfile` for the remote Workspace server mode, avoiding inclusion of local secret files and
      avoiding default local Plan filesystem authority.
- [ ] Step 3: Create `docker-compose.yml` with a persistent SQLite volume, environment variables, and a documented
      default port.
- [ ] Step 4: Add self-host setup docs covering Docker compose startup, database volume, public URL/reverse proxy
      expectations, and optional HTTP Basic/Auth proxy positioning if applicable.
- [ ] Step 5: Add CLI workflow docs for `wld plans share`, reviewer URL sharing, browser comments, `wld plans pull`,
      Planner/Architect feedback incorporation, `wld plans push`, and `wld plans unshare`.
- [ ] Step 6: Document the privacy model: server stores ciphertext for Plan/comment semantic content; allowed plaintext
      metadata; URL fragment key behavior; bearer capability risks; no accounts in v1.
- [ ] Step 7: Document secret storage and recovery: global default, optional project-local ignored storage, lost
      secrets, deleted remote, unavailable server, wrong capability, and local external edits.
- [ ] Step 8: Refresh the Collaborative Planning PRD and ADR if implementation decisions changed terminology or deferred
      scope.
- [ ] Step 9: Add a manual E2E checklist that starts Docker, shares a Plan, comments from two reviewers,
      resolves/reopens, pulls in another checkout, revises, pushes, and unshares.
- [ ] Step 10: Run formatting/docs checks, Docker smoke verification, and full project CI.

## Verification Plan

- Automated: `deno fmt --check docs README.md Dockerfile docker-compose.yml` if supported by Deno formatting rules for
  the touched files.
- Automated: `deno task ci`
- Manual: Run `docker compose up` and verify the remote Workspace mode starts with a persistent SQLite volume and no
  checkout-local Plan Board authority.
- Manual: Run the full self-hosted collaboration E2E: share a local Plan, open reviewer URL in a browser, add comments
  from two display names, resolve/reopen, pull as maintainer in another checkout, revise through Planner/Architect, push
  a new revision, verify revision-specific comments, then unshare from CLI.
- Manual: Inspect SQLite and network payloads to verify ciphertext-only semantic content and allowed plaintext metadata
  only.
- Expected: a user can self-host the remote Shared Space service and follow docs without requiring Cloudflare/D1 or a
  RunWield-hosted service.

## Edge Cases & Considerations

- Docker images must not bake in local secrets, Plan content, or developer-specific paths.
- Public base URL configuration affects generated share links; docs should explain reverse proxy/TLS expectations
  without requiring a production domain.
- The docs should use placeholder hostnames such as `plans.example.com`, not a committed production domain.
- D1/Cloudflare hosted deployment is a deferred follow-up Plan, not part of this Epic's done criteria.
- Documentation should be clear that maintainer URLs are equivalent to powerful bearer credentials.
