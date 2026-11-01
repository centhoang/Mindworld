---
name: handoff
description: Write or refresh HANDOFF.md so a fresh session can continue cheaply. Use at every milestone, when the session context is getting long, or when the user says "handoff", "new session" or "save state".
---

1. Read the current `HANDOFF.md` and `git status --short`.
2. Rewrite `HANDOFF.md` in place, **under 40 lines, each under 200 characters**, with sections: State, Decisions, Pending decisions (user), Next actions (max 3, concrete), Gotchas, File map, and the starting prompt on top. Move anything finished or old into `docs/archive/HISTORY.md`. Never paste keys or long logs.
3. Check `docs/BUGS.md` and `docs/testing/checks/` are current, and `CLAUDE.md` is under 70 lines.
4. If code changed, run the quick check (tests) and record the result in State.
5. Tell the user in two lines what is saved and whether to start a fresh session.
