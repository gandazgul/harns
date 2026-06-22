---
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Implement automatic installation and management of the `bwrap` binary in `~/.hns/bin/` to make read-only bash a first-class runtime requirement, mirroring the pattern used for Mnemosyne and Cymbal. This includes adding a preflight check to ensure `bwrap` is available on boot, implementing the download/install logic for Linux, and updating the tool to use the managed binary path."
affectedPaths:
    - "src/shared/runtime-preflight.js"
    - "src/tools/read-only-bash.js"
    - "src/shared/session/session.js"
    - "README.md"
    - "docs/settings.md"
createdAt: "2026-06-22T02:57:04Z"
updatedAt: "2026-06-22T03:17:45.831Z"
status: "feedback"
origin: "internal"
routingIntent: "FEATURE"
---

# Managed Runtime Binaries and Default Read-Only Router Bash

## Context

Harns currently treats Mnemosyne and Cymbal as hard runtime requirements that must already be available in `PATH`. The
new read-only bash mode also depends on Bubblewrap (`bwrap`) on Linux, but its first implementation only fails when a
read-only bash tool call tries to run without Bubblewrap. The user considers that a semantic failure because agents can
start work and then be unable to call necessary tools.

The clarified desired behavior is:

- Harns should manage required runtime tools under `~/.hns/bin/`, downloading missing supported binaries on boot.
- This applies to Mnemosyne, Cymbal, and the read-only bash backend dependency.
- `bwrap` is Linux-only and must not be required on macOS.
- Router should have read-only bash by default, not opt-in.
- macOS needs its own read-only bash solution rather than being broken by a Linux-only Bubblewrap assumption.

Discovery notes:

- Cymbal currently publishes Linux/macOS/Windows release archives.
- Mnemosyne currently publishes macOS/Windows archives in the latest release, but no Linux asset was found during
  planning. Linux auto-install may require publishing a Linux Mnemosyne artifact first.
- Bubblewrap official GitHub releases currently publish source tarballs, not ready-to-run `bwrap` binaries. Harns should
  not compile Bubblewrap from source at boot. Linux `bwrap` management requires either a Harns-maintained binary
  artifact/mirror or explicit package-manager guidance until such an artifact exists.
- macOS provides `/usr/bin/sandbox-exec` on the planning machine; per user feedback this is good enough for Harns
  because it follows the same general sandboxing mechanism used by Chromium.

## Objective

Build a managed runtime/tooling layer and default read-only Router behavior:

- Create and use `~/.hns/bin/` for Harns-managed runtime binaries.
- Auto-install supported missing binaries on boot, before any agent work starts.
- Prefer managed `~/.hns/bin/<binary>` over ambient `PATH` once installed.
- Keep `PATH` probing as a fallback only when a managed artifact is unavailable or while bootstrapping existing
  installations.
- Make Router's default effective `bashMode` `readOnly`, while still allowing user/project settings to override it to
  `default`.
- Use Linux Bubblewrap for read-only bash on Linux, with `bwrap` required only on Linux.
- Add a macOS read-only bash backend using `sandbox-exec`; do not require or download Bubblewrap on macOS.
- Keep RTK optional and do not auto-install it in this feature.

## Approach

Add a runtime binary manager module that owns managed installation and path resolution. `runtime-preflight` should
delegate to it and expose a combined boot preflight. The manager should describe each binary with a manifest entry:
binary name, requirement level, supported platform/architecture, release/source URL, asset-name matcher, checksum file
matcher, archive type, and extracted executable path.

Add a read-only bash backend abstraction inside `src/tools/read-only-bash.js` (or a small sibling module if it becomes
too large):

- Linux backend: current Bubblewrap command builder, using the resolved Linux `bwrap` path from runtime preflight.
- macOS backend: generated `sandbox-exec` profile that denies filesystem access by default, allows process execution,
  allows read-only access to the project and required system paths, grants a private scratch temp directory for writes,
  and preserves network access so agent bash can run configured web tools such as `ketch`.
- Unsupported platforms: fail clearly at boot if Router's default read-only bash cannot be supported.

At boot, call `ensureRequiredRuntimeBinaries()` before TUI initialization. It should ensure Mnemosyne and Cymbal via
managed install/path fallback, and ensure the platform-specific read-only bash backend dependency:

- Linux: ensure `bwrap` is available via managed artifact or existing `PATH`/package install, but only on Linux. The
  Bubblewrap invocation must preserve network access (for example by avoiding network namespace isolation or using
  Bubblewrap's network-sharing option) so configured web tools such as `ketch` can run from read-only bash.
- macOS: ensure `/usr/bin/sandbox-exec` is available; no `bwrap` requirement.

Do not modify `../pi-mono`; Harns should only use existing pi-coding-agent APIs already imported in this repo.

## Files to Modify

- `src/shared/runtime-binaries.js` — new managed binary resolver/downloader: manifests, `~/.hns/bin` paths,
  platform/arch mapping, release lookup, checksum verification, extraction hooks, atomic install, and resolved path
  getters.
- `src/shared/runtime-binaries.test.js` — tests for platform/arch asset selection, managed-path preference,
  existing-path fallback, unsupported/missing asset errors, checksum mismatch, and injected fake
  fetch/filesystem/archive/probe functions.
- `src/shared/runtime-preflight.js` — replace direct `PATH` probes with managed binary ensures; add
  `ensureRequiredRuntimeBinaries()`, platform-specific read-only bash dependency ensure, and
  `getResolvedRuntimeBinaryPath(name)`/`getReadOnlyBashBackendConfig()` exports.
- `src/shared/runtime-preflight.test.js` — update caching/error tests for managed install behavior; cover Linux
  bwrap-only requirement, macOS sandbox-exec requirement, and RTK remaining optional/live-probed.
- `src/shared/interactive/chat-session.js` — run combined required-runtime preflight before TUI initialization so first
  boot installs/validates tools before agents need them.
- `src/shared/interactive/chat-session.test.js` — cover boot invoking combined runtime preflight via dependency
  injection or existing startup tests.
- `src/shared/session/session.js` — use managed/resolved paths for defensive checks, pass platform backend config into
  `createReadOnlyBashToolDefinition`, and avoid duplicate per-session downloads.
- `src/shared/session/__tests__/session-tools-policy.test.js` — verify Router defaults to read-only bash, explicit
  `bashMode: "default"` opts out, and the read-only tool receives platform backend config/resolved path.
- `src/shared/settings.js` — change `getConfiguredAgentBashMode("router")` default to `readOnly` when unset/invalid,
  while preserving explicit base or active-preset overrides.
- `src/shared/settings.test.js` — cover Router's default read-only mode and opt-out behavior.
- `src/tools/read-only-bash.js` — add backend selection/config, keep Linux Bubblewrap builder, add macOS `sandbox-exec`
  profile/command builder, update errors to reference boot-managed dependencies.
- `src/tools/read-only-bash.test.js` — cover Linux Bubblewrap args, macOS sandbox profile/args, explicit backend config,
  unsupported platform errors, and no fallback to unrestricted bash.
- `src/cmd/sleep/index.js` — use the combined runtime preflight or managed Mnemosyne ensure so non-interactive sleep
  gets the same auto-install behavior.
- `src/cmd/sleep/index.test.js` — update dependency expectations.
- `README.md` — document `~/.hns/bin/`, first-run downloads, required vs optional binaries, Router read-only bash
  default, Linux/macOS backend split, and manual remediation.
- `docs/settings.md` — update read-only bash docs to say Router defaults to read-only, `bashMode: "default"` opts out,
  Linux uses Bubblewrap, macOS uses sandbox-exec, and managed binaries live under `~/.hns/bin/`.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/shared/runtime-preflight.js` — current central location for required/optional runtime binary checks and tests.
- `src/constants.js#HOME_DIR` and `src/shared/settings.js#getSettingsDir("global")` — use Harns' existing home/global
  settings location conventions for `~/.hns/bin`.
- `src/tools/read-only-bash.js#createReadOnlyBashToolDefinition` — already reuses pi-coding-agent's
  `createBashToolDefinition` rendering/result behavior.
- `src/shared/session/session.js#buildAgentSession` — existing preflight and custom tool injection point.
- Existing `fetch` mocking style in `src/shared/models/model-registry.test.js` — reuse the pattern for network-dependent
  tests without real downloads.
- `install.sh` release/checksum naming ideas — reuse release asset/checksum conventions where applicable, but do not
  shell out to this installer from runtime.

## Implementation Steps

- [ ] Step 1: Add `src/shared/runtime-binaries.js` with manifest JSDoc types, `getManagedBinDir()`, managed path
      helpers, absolute-path binary probing, GitHub latest-release asset lookup, checksum parsing/verification, archive
      extraction hooks, and atomic executable installation.
- [ ] Step 2: Encode manifests for Cymbal and Mnemosyne using their GitHub release assets where platform assets exist;
      for missing platform assets, fall back to an existing `PATH` binary with a clear "managed artifact unavailable"
      error if neither managed nor PATH binary works.
- [ ] Step 3: Encode read-only bash backend dependency policy: Linux requires `bwrap`; macOS requires
      `/usr/bin/sandbox-exec`; Windows/other platforms are unsupported unless a backend is added later.
- [ ] Step 4: For Linux `bwrap`, either wire a Harns-maintained binary artifact URL if available during implementation
      or leave managed auto-install unsupported with explicit package-manager/manual install guidance. Do not attempt to
      compile Bubblewrap source tarballs at boot.
- [ ] Step 5: Update `src/shared/runtime-preflight.js` to expose `ensureRequiredRuntimeBinaries()` and path/backend
      getters, cache successful checks, and keep `hasRtkBinary()` optional.
- [ ] Step 6: Call the combined preflight from interactive boot (`startInteractiveSession`) before TUI initialization
      and from `sleep` before agent work; keep `buildAgentSession` defensive but cached.
- [ ] Step 7: Change Router's default `bashMode` to `readOnly` in `getConfiguredAgentBashMode`, while allowing explicit
      `agents.router.bashMode: "default"` and active-preset overrides to opt out.
- [ ] Step 8: Update read-only bash execution to select a backend from preflight config: Linux Bubblewrap uses resolved
      `bwrapPath` while preserving network access; macOS `sandbox-exec` builds a temporary/private scratch dir and an
      SBPL profile that prevents project/host writes and non-allowed reads while preserving network access.
- [ ] Step 9: Ensure read-only bash never falls back to unrestricted shell on any backend failure. Errors should explain
      which backend failed and how to remediate.
- [ ] Step 10: Add/update tests across runtime-binaries, runtime-preflight, session tool policy, settings, read-only
      bash, chat session boot, and sleep command.
- [ ] Step 11: Update README and settings docs for first-run auto-install, managed binary path, Router default read-only
      bash, Linux/macOS backend behavior, and known unsupported cases.
- [ ] Step 12: Run formatting and full verification.

## Verification Plan

- Automated: `deno run ci`.
- Targeted while developing:
  - `deno test -A src/shared/runtime-binaries.test.js src/shared/runtime-preflight.test.js`
  - `deno test -A src/tools/read-only-bash.test.js src/shared/settings.test.js src/shared/session/__tests__/session-tools-policy.test.js`
  - `deno test -A src/shared/interactive/chat-session.test.js src/cmd/sleep/index.test.js`
- Manual first-run simulation:
  - Set `HOME` to a temp directory, run `hns router "hello"`, and verify `~/.hns/bin/` is created and supported missing
    binaries are installed or produce a clear unsupported-managed-artifact message.
  - Re-run and verify no download happens when managed binaries already exist and pass probe.
  - Remove one managed binary and verify boot reinstalls or falls back according to policy.
- Manual Linux read-only bash check:
  - Verify `bwrap` is required/resolved only on Linux.
  - Start Router with no explicit `bashMode`; verify Router receives read-only bash by default.
  - Verify discovery commands such as `pwd`, `ls`, and `grep` work.
  - Verify `touch should-not-exist` or `echo x > file` fails and does not create project files.
  - Verify attempts to read `~/.ssh` or write outside the project fail from the sandbox.
  - Verify a configured web command such as `ketch` can still access the network from read-only bash.
- Manual macOS read-only bash check:
  - Start Router with no explicit `bashMode`; verify Router receives the macOS read-only backend without requiring
    `bwrap`.
  - Verify basic discovery commands work.
  - Verify project writes and reads of sensitive home paths fail.
  - Verify a configured web command such as `ketch` can still access the network from read-only bash.
  - Verify unsupported sandbox profile behavior is reported before agent work if `sandbox-exec` is unavailable.

## Edge Cases & Considerations

- Auto-downloading executable code has supply-chain implications. Use HTTPS release assets, checksum verification when
  provided, temp-file atomic moves, executable permission checks, and clear source documentation.
- Current Mnemosyne releases may not include Linux artifacts; implementation may need a release-pipeline follow-up
  before Linux first-run auto-install can be complete.
- Bubblewrap official releases are source-only; a safe managed Linux `bwrap` auto-install requires a trusted prebuilt
  artifact source or Harns-maintained mirror. Otherwise Linux can only fail at boot with package-manager guidance.
- macOS `sandbox-exec` is deprecated by Apple but still present on current macOS. The implementation should isolate this
  backend behind tests and clear errors in case it disappears.
- Sandbox profiles are easy to make too permissive or too restrictive. Prefer filesystem deny-by-default and expand only
  the minimum file paths needed for shell utilities, while intentionally preserving network access for configured web
  tools like `ketch`.
- Network may be unavailable on first boot. The UX should distinguish "download failed" from "unsupported
  platform/source" and provide manual install paths.
- Windows is not covered by this feature unless a read-only bash backend is chosen later.
- Direct `!` / `!!` human shell shortcuts remain unchanged.
