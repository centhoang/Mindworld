---
name: handoff
description: Write or refresh HANDOFF.md so a fresh session can continue cheaply. Use at every milestone, when the session context is getting long, or when the user says "handoff", "new session" or "save state".
---

1. Read the current `HANDOFF.md` and `git status --short`.
2. Rewrite `HANDOFF.md` in place (no size limit; keep everything the next session needs, nothing it does not), with sections: State, Decisions, Pending decisions (user), Next actions (concrete), Gotchas, File map, and the starting prompt on top. Move anything finished or old into `docs/archive/HISTORY.md`. Never paste keys or long logs.
3. Check `docs/BUGS.md` and `docs/testing/checks/` are current.
4. If code changed, run the quick check (tests) and record the result in State.
5. Tell the user in two lines what is saved and whether to start a fresh session.
