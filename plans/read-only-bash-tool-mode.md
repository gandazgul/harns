---
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Add an opt-in Bubblewrap-backed read-only mode for the agent bash tool, configurable per agent such as router."
affectedPaths:
    - "src/tools/read-only-bash.js"
    - "src/tools/read-only-bash.test.js"
    - "src/shared/settings.js"
    - "src/shared/settings.test.js"
    - "src/shared/session/session.js"
    - "src/shared/session/__tests__/session-tools-policy.test.js"
    - "docs/settings.md"
    - "README.md"
createdAt: "2026-06-22T02:05:18Z"
updatedAt: "2026-06-22T02:46:32.243Z"
status: "draft"
origin: "internal"
---

# Read-Only Bash Tool Mode

## Context

The user wants Harns to sometimes expose `bash` as a genuinely constrained read-only command runner, especially for
discovery-only agents such as Router. Prompt instructions currently say Router may use bash only for discovery, but the
runtime still executes normal shell commands with the same user privileges as Harns. This feature should make read-only
bash an enforceable runtime property rather than a behavioral instruction.

Bubblewrap is a good fit for the first implementation because it can create a Linux sandbox with a read-only bind mount
of the project, private writable scratch space, no host home directory, dropped capabilities, and isolated namespaces.
This should be opt-in so existing non-Linux setups and agents that need full shell access keep working. Per user
clarification, do not make Router read-only by default; document how to opt Router in through settings.

## Objective

Add a configurable `bashMode: "readOnly"` for agent sessions. When enabled for an agent with the `bash` tool, Harns
should replace the built-in `bash` tool definition with a custom tool named `bash` that executes commands through
Bubblewrap and fails closed if the sandbox cannot be created.

The first target configuration should be per-agent, for example:

```jsonc
{
    "agents": {
        "router": {
            "bashMode": "readOnly"
        }
    }
}
```

## Approach

Implement a Harns custom `bash` tool definition that reuses pi-coding-agent's existing `createBashToolDefinition`
rendering, output truncation, timeout, and result formatting, but supplies a custom `operations.exec` backend. The
backend should spawn `bwrap` with a read-only bind of the session cwd and minimal read-only system paths needed to
execute shell utilities.

Recommended sandbox behavior:

- Linux/Bubblewrap only for this feature slice; unsupported platforms must not make Harns fail at startup or session
  construction. If read-only bash is configured and the tool is actually called without Bubblewrap support, return a
  clear tool error and do not fall back to unrestricted bash.
- Bind the project/session cwd read-only at the same path and set it as the working directory.
- Hide the user's home directory and clear the environment, re-adding only minimal safe variables such as `PATH`,
  `TERM`, and `LANG` if needed.
- Expose common system executable/library locations read-only (`/bin`, `/usr`, `/lib`, `/lib64`, etc., using
  `--ro-bind-try` where appropriate).
- Provide private writable scratch locations only where required for processes to run, such as a sandbox-private `/tmp`;
  never bind host project paths writable.
- Use namespace isolation and privilege controls such as `--unshare-all`, `--die-with-parent`, `--new-session`, and
  `--cap-drop ALL` where supported.
- Preserve signal/timeout behavior by killing the Bubblewrap process on abort or timeout.
- Do not implement command string deny/allow heuristics as the security boundary; the mount namespace and permissions
  are the boundary.

Keep `!` / `!!` interactive user bash behavior unchanged for now. This request is about the agent `bash` tool used
inside model sessions, not the human operator's direct shell shortcut.

## Files to Modify

- `src/tools/read-only-bash.js` — new Bubblewrap-backed `bash` tool factory plus pure helpers for building sandbox args
  and validating mode/platform.
- `src/tools/read-only-bash.test.js` — unit tests for generated Bubblewrap arguments and fail-closed behavior that do
  not require Bubblewrap to be installed.
- `src/shared/settings.js` — add `getConfiguredAgentBashMode(agentName)` or equivalent helper resolving base
  `agents.<agent>.bashMode` and active preset overrides.
- `src/shared/settings.test.js` — cover bash mode preservation/lookup if the helper lives in settings.
- `src/shared/session/session.js` — when building a session, inject the read-only custom bash tool for agents configured
  with `bashMode: "readOnly"`; ensure the final system prompt advertises the restricted bash description.
- `src/shared/session/__tests__/session-tools-policy.test.js` — verify session construction wires the custom `bash` tool
  only for configured agents and leaves default agents unchanged.
- `docs/settings.md` — document `agents.<agent>.bashMode`, Bubblewrap/Linux requirements, the fail-closed tool-call
  behavior, and a Router example.
- `README.md` — add a concise runtime-requirements note that read-only bash mode requires Bubblewrap on Linux and is not
  available on Windows/macOS in this first implementation.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `@earendil-works/pi-coding-agent#createBashToolDefinition` — reuse existing bash schema, renderer, output
  streaming/truncation, timeout result formatting, and tool name compatibility.
- `src/shared/session/session.js` custom-tool injection pattern — follow existing wiring for Harns-owned overrides such
  as `grep`, `multi_file_edit`, `see_image`, `task_completed`, and `plan_written`.
- `src/shared/settings.js#getMergedCustomSetting` — reuse existing global/project merge behavior for `agents` and
  `modelPresets`.
- `src/shared/session/__tests__/session-tools-policy.test.js` — reuse existing build-session test setup with temporary
  HOME/model config.
- `docs/settings.md` Agent Model Overrides section — extend the existing per-agent settings documentation instead of
  adding a separate document.

## Implementation Steps

- [ ] Step 1: Add `src/tools/read-only-bash.js` with a pure `buildBubblewrapBashArgs({ cwd, command, env })` helper and
      `createReadOnlyBashToolDefinition(cwd, options = {})`.
- [ ] Step 2: In the read-only bash backend, spawn `bwrap` with a read-only project bind, private `/tmp`, no host home,
      cleared environment, namespace isolation, dropped capabilities, and read-only system path binds required for shell
      tools.
- [ ] Step 3: Implement fail-closed tool-call checks/messages for unsupported OS, missing Bubblewrap, spawn failure,
      abort, and timeout; do not fail during Harns startup/session creation, and do not silently run normal bash when
      read-only mode is requested.
- [ ] Step 4: Add per-agent bash mode resolution from merged settings, including active
      `modelPresets.<preset>.agents.<agent>.bashMode` winning over base `agents.<agent>.bashMode`, with accepted values
      `"default"` and `"readOnly"`.
- [ ] Step 5: Wire `buildAgentSession` so configured `readOnly` agents that include `bash` receive the custom tool named
      `bash`; leave agents without `bash`, agents with `bashMode: "default"`, and sessions with an explicit runtime
      custom `bash` tool unchanged.
- [ ] Step 6: Ensure `assembleFinalSystemPrompt` describes the read-only bash tool when it is injected, because custom
      tool descriptions already override built-in descriptions in the prompt map.
- [ ] Step 7: Add tests for argument construction, fail-closed behavior, settings resolution, and session wiring.
- [ ] Step 8: Update `docs/settings.md` with configuration examples, requirements, behavior guarantees, and limitations.
- [ ] Step 9: Update `README.md` runtime requirements with a short Bubblewrap/Linux notice for read-only bash mode.

## Verification Plan

- Automated: run `deno run ci`.
- Automated targeted checks while developing:
  - `deno test -A src/tools/read-only-bash.test.js`
  - `deno test -A src/shared/settings.test.js src/shared/session/__tests__/session-tools-policy.test.js`
- Manual Linux check with Bubblewrap installed:
  - Configure `agents.router.bashMode: "readOnly"`.
  - Start Harns, trigger Router, and verify read-only discovery commands such as `pwd`, `ls`, and `grep` work.
  - Verify `touch should-not-exist` or `echo x > file` from Router bash fails and does not create files.
  - Verify attempts to read `~/.ssh`, write outside the project, or use network access fail from the sandbox.
- Manual unsupported-platform/missing-bwrap check:
  - With read-only mode configured but Bubblewrap unavailable, Harns still starts and creates the agent session.
  - A Router bash call returns a clear unsupported/missing-Bubblewrap error and does not execute unrestricted shell.

## Edge Cases & Considerations

- Bubblewrap is Linux-specific. Windows/macOS users should see documentation that the mode is unavailable in this first
  implementation; Harns itself must not fail just because the platform is unsupported.
- Some commands need writeable temp files. Provide only sandbox-private `/tmp`; commands may work if they write there,
  but cannot write project or host files.
- Some discovery tools may depend on hidden home config or network access. That is intentionally unavailable in
  read-only mode for safety.
- Exposing `/usr` and other system paths read-only means the sandbox can read system files needed to run commands; it
  should not expose the user's non-project files.
- User namespace support can be disabled on some Linux systems. Treat that as an unavailable sandbox and fail closed.
- Do not change the direct `!` / `!!` human bash shortcut in this feature; changing that behavior would need separate UX
  and configuration decisions.
