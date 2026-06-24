---
classification: "FEATURE"
complexity: "LOW"
summary: "Create a JSON schema for wld settings.json and document how to reference it via GitHub releases. This involves defining the schema based on RUNWEILD_CUSTOM_SETTING_KEYS and existing settings logic in src/shared/settings.js, and updating the README to provide the $schema URL."
affectedPaths:
    - "config.schema.json"
    - "README.md"
createdAt: "2026-06-23T21:07:43-04:00"
updatedAt: "2026-06-24T01:13:21.612Z"
status: "draft"
origin: "internal"
---

# Settings JSON Schema Release Asset

## Context

RunWeild users edit global and project settings in JSONC files at `~/.wld/settings.json` and `.wld/settings.json`. The
user wants those files to be able to reference a schema directly from GitHub, using the same style as:

```json
{
    "$schema": "https://github.com/gandazgul/runwield/releases/latest/download/config.schema.json"
}
```

There is currently no settings schema file in the repository, and the release workflow only uploads compiled binaries
and `SHA256SUMS`.

## Objective

Add a permissive-but-useful JSON Schema for RunWeild settings and ensure release publishing attaches it as
`config.schema.json`, so editors can fetch the schema from
`https://github.com/gandazgul/runwield/releases/latest/download/config.schema.json`. Document the URL and an example
`$schema` entry for both global and project settings files.

## Approach

Create a root `config.schema.json` using JSON Schema draft 2020-12. Model both RunWeild custom settings from
`src/shared/settings.js` / `docs/settings.md` and Pi-backed settings from `@earendil-works/pi-coding-agent`'s `Settings`
interface. Keep the schema forward-compatible by allowing additional properties while defining known properties for
autocomplete and validation. Include `$schema` as an allowed string property because users will place the schema URL
directly in their settings files.

Update `.github/workflows/release.yml` so the release job checks out the repository and includes the root schema file in
the `softprops/action-gh-release` file list. Add concise documentation in `docs/settings.md` and a short README pointer.

## Files to Modify

- `config.schema.json` — new root JSON Schema release asset for RunWeild settings.
- `.github/workflows/release.yml` — check out the repo in the release job and upload `config.schema.json` alongside
  binary assets.
- `docs/settings.md` — document the `$schema` URL, JSONC compatibility note, and example usage.
- `README.md` — add a brief settings-schema pointer near the settings/data-location documentation.

## Reuse Opportunities

Existing source/docs to mirror rather than invent:

- `src/shared/settings.js` — RunWeild custom setting keys and runtime behavior for `agents`, `modelPresets`,
  `visionFallback`, `compactOnResumeThresholdPercent`, `verification_command`, `codereview`, cleanup, and external
  skill/global prompt toggles.
- `src/shared/session/session.js` — per-agent `model`, `thinkingLevel`, and `temperature` resolution rules.
- `docs/settings.md` — current public settings reference and examples.
- `../pi-mono/packages/coding-agent/src/core/settings-manager.ts` — upstream Pi-backed `Settings` shape for inherited
  keys.
- `.github/workflows/release.yml` — existing release asset publishing path.

## Implementation Steps

- [ ] Add `config.schema.json` at the repository root.
  - Use draft 2020-12 metadata: `"$schema": "https://json-schema.org/draft/2020-12/schema"`.
  - Set `$id` to `https://github.com/gandazgul/runwield/releases/latest/download/config.schema.json`.
  - Define reusable `$defs` for thinking levels, provider/model references, agent overrides, presets, package sources,
    compaction, branch summaries, retry settings, terminal settings, image settings, thinking budgets, markdown,
    warnings, and path/string arrays.
  - Include top-level known properties from RunWeild custom keys and Pi-backed settings.
  - Include top-level `"$schema"` as a string property with the recommended URL.
  - Leave `additionalProperties: true` so future upstream Pi keys and extension-owned settings do not become false
    errors.
- [ ] Ensure schema coverage matches current behavior and docs.
  - RunWeild custom keys: `agents`, `activeModelPreset`, `modelPresets`, `visionFallback`,
    `compactOnResumeThresholdPercent`, `verification_command`, `codereview`, `cleanupMergedWorktrees`,
    `enableExternalSkills`, `enableExternalGlobalAgentsMd`.
  - Agent override fields: `model` as `provider/model_id`, `thinkingLevel` enum `off|minimal|low|medium|high|xhigh`,
    `temperature` number `0` through `2`.
  - Preset shape: optional `agents` map plus optional `visionFallback`.
  - Pi-backed keys: mirror `Settings` from `@earendil-works/pi-coding-agent`, including keys already documented in
    `docs/settings.md` and newer inherited keys such as `defaultProjectTrust`, `enableAnalytics`, `trackingId`,
    `httpProxy`, `httpIdleTimeoutMs`, and `websocketConnectTimeoutMs` if present upstream.
  - Include deprecated legacy migration keys only if useful for existing files: `queueMode`, `websockets`, and
    `retry.maxDelayMs`; mark them with `deprecated: true` and descriptions that point to the modern keys.
- [ ] Update `.github/workflows/release.yml`.
  - Add a checkout step to the `release` job before publishing assets, because the current release job only downloads
    artifacts.
  - Add `config.schema.json` to `softprops/action-gh-release` `files:` so tags publish a release asset named exactly
    `config.schema.json`.
- [ ] Update `docs/settings.md` (use the documentation skill if following agent-skill guidance during implementation).
  - Add a short “JSON Schema” section near the top with the exact `$schema` URL and a JSONC example.
  - Explain that settings files are JSONC, but the schema asset itself is strict JSON for editor compatibility.
  - Mention that the schema is intentionally permissive for unknown keys but validates/autocompletes known RunWeild and
    inherited Pi settings.
  - If the schema includes inherited Pi-backed keys missing from the current table, add concise rows for them or
    explicitly note that the schema includes currently inherited upstream settings.
- [ ] Update `README.md`.
  - Add a concise pointer that `~/.wld/settings.json` / `.wld/settings.json` can include the GitHub release `$schema`
    URL.
  - Link to `docs/settings.md` for the complete settings reference.
- [ ] Validate formatting and syntax.
  - Parse `config.schema.json` with `JSON.parse`.
  - Run Deno formatting checks on the changed JSON, YAML, and Markdown files.

## Verification Plan

- Automated:
  - `deno eval 'JSON.parse(await Deno.readTextFile("config.schema.json")); console.log("schema ok")'`
  - `deno fmt --check config.schema.json .github/workflows/release.yml docs/settings.md README.md`
- Manual:
  - Confirm `config.schema.json` contains
    `$id: "https://github.com/gandazgul/runwield/releases/latest/download/config.schema.json"`.
  - Confirm `.github/workflows/release.yml` uploads `config.schema.json` as a top-level release asset, not inside a
    tarball.
  - Open a sample settings object containing the documented `$schema`, `agents.router.model`,
    `modelPresets.fast.visionFallback.model`, `codereview`, and `packages` entries against the schema in an editor or
    schema validator to verify autocomplete/validation appears sensible.
- Expected results:
  - The schema JSON parses cleanly.
  - Formatting checks pass.
  - Future GitHub releases expose `config.schema.json` at `/releases/latest/download/config.schema.json`.

## Edge Cases & Considerations

- GitHub `releases/latest/download/...` only resolves after a release containing the schema has been published; before
  the next release, local docs can point users to the raw file or explain that the URL becomes available on release.
- Settings files are JSONC, but JSON Schema files must remain strict JSON; do not add comments to `config.schema.json`.
- `additionalProperties: true` is intentional to avoid blocking upstream Pi settings, extension-owned settings, and
  future RunWeild keys.
- The schema should validate shapes that RunWeild actually tolerates; avoid over-constraining model IDs because many
  providers use slash-containing model names after the provider prefix.
- Existing dirty working tree file `src/shared/ui/boot-logo.js` is unrelated and should not be modified by this feature.
