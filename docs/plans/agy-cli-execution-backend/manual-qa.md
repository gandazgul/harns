# Manual QA for agy-cli-execution-backend

This checklist is advisory. It does not change RunWield verification status.

<!-- runwield:manual-qa:start child="agy-cli-execution-backend/01-prove-agy-custom-agent-execution-spike" -->

## Prove Agy Custom Agent Execution Spike

Manual verification steps for agy-cli-execution-backend/01-prove-agy-custom-agent-execution-spike

- [ ] Approve and run the live proof with an explicit unique `runwield-spike-*` agent name and the installed,
      authenticated `agy` CLI.
- [ ] Confirm `/agents` lists the exact temporary agent name.
- [ ] Confirm the user argument contains the User marker and does not contain the Agent marker or Agent Definition text.
- [ ] Confirm the raw terminal result and parsed final text equal the Agent marker, differ from the User marker, and the
      command exits successfully.
- [ ] Confirm cleanup removes the temporary agent file and directory after the proof.

<!-- runwield:manual-qa:end child="agy-cli-execution-backend/01-prove-agy-custom-agent-execution-spike" -->

<!-- runwield:manual-qa:start child="agy-cli-execution-backend/02-register-agy-cli-backend-models" -->

## Register Agy CLI Backend Models

Manual verification steps for agy-cli-execution-backend/02-register-agy-cli-backend-models

- [ ] In a disposable project with a working Pi model, enter `/model agy-cli/<installed-model-id>` and confirm the
      current model stays unchanged, the deferred message appears, and the Antigravity reference is saved as the
      default.
- [ ] Open `/login api-key` and `/status` and confirm that Antigravity is not shown as an API provider.
- [ ] Check model completion and picker data and confirm that no built-in `agy-cli` model appears, while a direct
      `agy-cli/<model-id>` reference remains accepted.
- [ ] Confirm that no `agy` process starts during these checks and that Antigravity is not routed through Pi.

<!-- runwield:manual-qa:end child="agy-cli-execution-backend/02-register-agy-cli-backend-models" -->
