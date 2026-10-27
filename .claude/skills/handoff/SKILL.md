---
name: handoff
description: Write or refresh HANDOFF.md so a fresh session can continue cheaply. Use at every milestone, when the session context is getting long, or when the user says "handoff", "new session" or "save state".
---

1. Read the current `HANDOFF.md` (it is small) and `git status --short`.
2. Rewrite `HANDOFF.md` in place, under ~80 lines, with sections: State, Decisions made (with why), Pending decisions (user), User-only actions, Next actions (max 3, concrete), Gotchas, File map. Drop anything finished or obsolete; never paste keys or long logs.
3. If code changed, run the project's quick check (build or tests) and record the result in State.
4. Tell the user in two lines: what is saved and whether to start a fresh session now (yes when context is long or a phase ended).
