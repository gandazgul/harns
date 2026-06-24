---
description: Generates a concise commit message, stages changes, and pushes to the remote.
---

# Commit

Generate a concise, informative commit message and commit the current pending changes in the repo, be default all
changes staged or not, even unrelated to any other context. If there are staged changes and the unstaged ones seem very
different and unrelated then feel free to make 2 commits instead of one.

**Execution Steps:**

1. Run `git status` and `git diff` to analyze the pending changes.
2. Generate a strict, imperative-mood commit message (e.g., "Add feature", not "Added feature").
3. Keep the subject line under 50 characters. If there are multiple distinct changes, add a blank line and list them as
   bullet points in the commit body.
4. Stage the modified files (e.g., `git add -A`) and execute the commit.
5. Run `git push` to sync the changes upstream.
