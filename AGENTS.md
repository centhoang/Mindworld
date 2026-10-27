# Instructions for Codex (second AI on this project; Claude Code is the lead)

Read `CLAUDE.md` for the project rules (hackathon compliance, money, stay-in-project). Key points for you:
- Work only inside this folder. Never read or print `.env` or any secret. Never commit, push, post online, or install global tools.
- Do only the task in the brief, touching only the files it names. Claude reviews your result, so keep changes small and focused.
- Keep every paid-API call behind the cost-capped wrapper described in `CLAUDE.md`. Mock the LLM in tests.
- Plan and facts live in `docs/PLAN.md` and `docs/EVENT.md`; current state in `HANDOFF.md`. Do not re-read the raw event HTML.
- Finish with a final message of at most 15 lines: what you changed (file list), how you verified it, open risks.
