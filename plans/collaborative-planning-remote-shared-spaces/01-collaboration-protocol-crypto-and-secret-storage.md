---
planId: "78ec879b-5ea5-4f32-95ce-df5d690eed3f"
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Create the shared collaboration foundation: protocol payload shapes, AES-GCM encryption helpers, URL fragment handling, capability hashing, API client primitives, Plan Server setting support, and secret-store adapters. This slice is independently verifiable with crypto/protocol/secret-store tests and does not expose any share/pull/push commands yet."
affectedPaths:
    - ".gitignore"
    - "deno.json"
    - "src/shared/settings.js"
    - "src/shared/settings.test.js"
    - "src/shared/collaboration/"
frontend: false
createdAt: "2026-07-04T14:52:22.894Z"
updatedAt: "2026-07-04T14:52:22.894Z"
status: "draft"
origin: "internal"
parentPlan: "collaborative-planning-remote-shared-spaces"
order: 1
dependencies:
    []
---

# Collaboration Protocol, Crypto, and Secret Storage

## Context

Collaborative Planning needs a safe foundation before any remote server or CLI command can share Plans. The remote
server must store ciphertext, authorization bearer capabilities must be separate from encryption keys, and local secret
material must never be written to Plan front matter or normal settings.

This slice builds the reusable protocol and storage layer in pure JavaScript/JSDoc so later slices can implement remote
Workspace mode and `wld plans` commands without inventing ad hoc crypto or secret handling.

## Objective

Add shared collaboration modules for encrypted payload handling, URL fragments, reviewer/maintainer capabilities,
capability hashing, API client request shapes, non-secret Plan Server URL settings, and local secret storage. The result
should be testable without a running remote server and should make secret leakage hard by default.

## Approach

Create a new `src/shared/collaboration/` area with small focused modules and JSDoc typedefs for protocol types.
Port/adapt the AES-GCM/content-key and URL-fragment concepts from Plannotator into pure `.js` files, keeping
authorization bearer capabilities outside encrypted content keys. Add a global-first secret store with optional
project-local storage only when explicitly requested, and ignore the project-local secret file in `.gitignore`.

Keep the Plan Server URL as a non-secret custom setting in `src/shared/settings.js`. Do not store content keys, reviewer
capabilities, maintainer capabilities, capability hashes, or full collaboration URLs in normal settings or Plan front
matter.

## Files to Modify

- `.gitignore` — ignore project-local collaboration secret files such as `.wld/collaboration-secrets.json` without
  globally ignoring all `.wld/` settings behavior.
- `deno.json` — add imports only if required for SQLite-independent protocol tests; keep source pure JavaScript/JSDoc.
- `src/shared/settings.js` — add helpers for reading/writing the non-secret default Plan Server URL custom setting.
- `src/shared/settings.test.js` — cover Plan Server URL custom setting merge behavior and ensure it remains non-secret.
- `src/shared/collaboration/base64url.js` — encode/decode helpers for binary payloads and compact URL-safe strings.
- `src/shared/collaboration/crypto.js` — AES-GCM key generation, import/export, encrypt/decrypt, tamper failure, and
  wrong-key failure helpers.
- `src/shared/collaboration/capabilities.js` — random reviewer/maintainer bearer token generation, redaction helpers,
  and SHA-256 capability hashing.
- `src/shared/collaboration/urls.js` — build and parse reviewer/maintainer URLs with URL fragment content keys and
  bearer capability fields.
- `src/shared/collaboration/protocol.js` — JSDoc typedefs and validation helpers for Shared Space, revision, comment,
  resolve/reopen, delete, and error payloads.
- `src/shared/collaboration/client.js` — fetch-based API client primitives with bearer capability headers and redacted
  error messages.
- `src/shared/collaboration/secrets.js` — global and optional project-local secret store adapters with atomic read/write
  behavior and redaction.
- `src/shared/collaboration/*.test.js` — unit tests for crypto, URL, capability, client, settings, and secret-store
  behavior.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `../plannotator/packages/shared/crypto.ts` — design reference for AES-GCM/content-key flow; port concepts only into
  `.js` with JSDoc.
- `../plannotator/packages/ui/utils/sharing.ts` — design reference for URL-fragment key handling and compact sharing
  URLs.
- `src/shared/settings.js` — existing RunWield custom setting storage and merge behavior for non-secret Plan Server URL
  support.
- `src/plan-store.js` — existing durable `planId` terminology for protocol payload fields, without writing secrets to
  front matter.
- `src/cmd/plans/ui.js` — URL construction and redacted output style for later CLI commands.

## Implementation Steps

- [ ] Step 1: Add JSDoc typedefs in `src/shared/collaboration/protocol.js` for Shared Space metadata, revision metadata,
      encrypted comment records, reviewer/maintainer capability scopes, API errors, and local secret records.
- [ ] Step 2: Implement `base64url.js` and tests covering UTF-8, binary round trips, invalid input, and URL-safe output.
- [ ] Step 3: Implement `crypto.js` with AES-GCM content-key generation, exported key strings for URL fragments,
      encrypt/decrypt helpers, and tests proving wrong keys and tampered ciphertext fail closed.
- [ ] Step 4: Implement `capabilities.js` with random bearer capability generation, SHA-256 hashing, scope constants,
      and redaction helpers for logs/errors.
- [ ] Step 5: Implement `urls.js` that builds/parses reviewer and maintainer URLs where the content key stays in the
      fragment and bearer authorization is clearly distinct from the content key.
- [ ] Step 6: Implement `secrets.js` with a global default secret store and optional project-local ignored file support;
      ensure all writes are JSON and redact secret values in thrown errors.
- [ ] Step 7: Add `.gitignore` entries for project-local collaboration secrets while leaving `.wld/settings.json`
      behavior unchanged.
- [ ] Step 8: Add `getDefaultPlanServerUrl`/`setDefaultPlanServerUrl` style helpers in `src/shared/settings.js`, plus
      tests that only non-secret URL values are stored.
- [ ] Step 9: Implement `client.js` request helpers for later slices, including bearer headers, `--plan-server` base URL
      override support at the API-client layer, JSON error handling, and capability redaction.
- [ ] Step 10: Run focused tests and the full project CI.

## Verification Plan

- Automated: `deno test -A src/shared/collaboration src/shared/settings.test.js`
- Automated: `deno task ci`
- Manual: Inspect generated test fixtures and temporary settings files to verify no content keys, reviewer capabilities,
  maintainer capabilities, or full share URLs are stored in Plan front matter or normal settings.
- Manual: Parse a reviewer URL and a maintainer URL and verify the content key is present only in the fragment, while
  bearer authorization is independently represented and redactable.
- Expected: encrypted content round trips with the correct key; wrong-key/tamper cases fail; capability hashes are
  deterministic but do not reveal bearer values; project-local secret storage is ignored by git.

## Edge Cases & Considerations

- Browser and Deno crypto APIs differ at the edges; keep helpers based on `crypto.subtle` and test in Deno, then let the
  browser slice reuse the same public contract.
- Do not introduce TypeScript files or TypeScript syntax; use `.js` and JSDoc typedefs only.
- Secret stores must be conservative: redaction should apply to errors, logs, and snapshots.
- The API client should not decide CLI UX. It should expose structured errors that later commands can translate into
  actionable messages.
- Cloudflare/D1-specific protocol behavior is intentionally out of scope for this self-hosted-first Epic.
