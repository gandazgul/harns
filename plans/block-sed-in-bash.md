---
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Add sed command interception to block sed in bash tool and remind LLM to use write tool instead. If write tool is not available to the agent, sed should be blocked entirely. Implementation requires creating a custom bash tool wrapper in session.js that intercepts sed commands before execution."
affectedPaths:
    - "src/shared/session/session.js"
    - "src/shared/session/agents.js"
    - "src/tools/registry.js"
createdAt: "2026-05-11T00:00:00.000Z"
updatedAt: "2026-05-11T15:49:43.403Z"
status: "completed"
origin: "internal"
---

# Block sed Commands in bash Tool

## Context

The LLM sometimes uses `sed` to edit files directly via bash commands. This is less safe than using the `write` tool
which provides better control and auditability. We want to intercept sed commands and either block them entirely (if
write is not available) or redirect the LLM to use the write tool instead.

## Objective

Create a custom bash tool wrapper that:

1. Detects when a bash command contains `sed`
2. Checks if the `write` tool is available to the agent
3. Returns an appropriate error message:
   - If write is NOT available: "sed is blocked because the write tool is not available to you"
   - If write IS available: "Use the write tool instead of sed to edit files"

## Approach

Create a custom bash tool definition in session.js that intercepts sed commands. The custom tool will:

1. Import the necessary Deno APIs to execute bash commands
2. Check the command for sed patterns (command starts with sed, or sed anywhere in a pipeline)
3. Based on write tool availability, return the appropriate blocked message OR execute the command

Implementation will be in session.js where custom tools are auto-wired. This keeps all the logic in one place and
follows the existing pattern for custom tools.

## Files to Modify

- `src/shared/session/session.js` — Add custom bash tool with sed interception in the auto-wiring section (around
  line 514)

## Reuse Opportunities

- Deno's built-in process APIs (`Deno.Command`) for bash execution — standard Deno approach
- Existing pattern for adding custom tools in session.js (like switch_agent, plan_written)

## Implementation Steps

- [ ] In session.js, after the existing custom tool auto-wiring section (around line 539), add a check for bash tool
- [ ] Import `Deno.Command` (already available in Deno projects) to execute bash commands
- [ ] Create a custom bash tool definition with an execute function that:
  - Parses the command to detect sed usage (regex: /\b(sed|\\sed)\b/ or command starts with "sed")
  - Checks `tools.includes("write")` to determine write availability
  - Returns blocked message if sed detected, otherwise executes via Deno.Command
- [ ] Handle proper output streaming (stdout/stderr) and error handling similar to the original bash tool

## Verification Plan

- Automated: Run `deno test` to ensure no regressions
- Manual:
  1. Start hns with an agent that has both bash and write tools
  2. Have the LLM try to run `sed -i 's/foo/bar' file.txt`
  3. Verify it returns the "use write tool" message
  4. Test with an agent that has bash but NOT write
  5. Verify it returns "write tool is not available" message
  6. Test that normal bash commands still work

## Edge Cases & Considerations

- sed in pipelines: Need to detect sed anywhere in the command, not just at the start
- Security: The custom execute should NOT return the actual command output when blocked
- Timeout: Support the timeout parameter like the original bash tool
- Output streaming: Should still support onUpdate callbacks for streaming output
