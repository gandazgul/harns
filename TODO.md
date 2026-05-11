# TODO

- [ ] more tests
- [ ] Start implementing the code indexing (cymbal is good for now)
- [ ] Auto-sleep: trigger memory consolidation automatically at session end when a threshold is crossed (e.g.,
      memories_added_since_last_sleep >= 10 OR total_memory_count > 50). Show brief "Running memory consolidation..."
      before exit. Natural boundary — user is done, latency acceptable, fresh context to consolidate.
- [ ] When re-executing a completed plan, warn the user if files in `affectedPaths` have changed since the plan ran.
      Show a list of commits between the plan's `updatedAt` (or `createdAt`) and HEAD as a heads-up before kicking off
      execution again.
- [ ] Plan archiving: move old plans (e.g., completed > N days) into `plans/archive/` so the active plans list stays
      short. Surface archived plans only on explicit request.
- [ ] Optional plan-review step after `completed`: add an `in_review` state between approved-execution and `completed`
      so a code-review/plan-review pass can sign off before the plan is closed.
- [ ] Look at mastra framework to see if we can incorporate it for better plan management and execution control.

bugs

- after saying no to init hns locked up
- on start in a new project we drop a .hns/setting.json that's empty we should not do this. Don't create any files until
  we have actual content to put in them. This is especially important for the settings file which should be created on
  demand when the user actually changes a setting, not pre-emptively on boot.
