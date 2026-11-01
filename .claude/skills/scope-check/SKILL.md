---
name: scope-check
description: Test one project scope (visual, npc, pet, network, game) against its checklist, add proof, and report only what changed. Use when the user says "check <scope>", "run the list", or before asking the user to review a scope.
---

1. Read `docs/testing/checks/<scope>.md` only.
2. Publish first if the scope changed since the last deploy (`scope-publish`). Check the deployed build, not localhost.
3. Walk each line that is not `[x]`, plus any `[x]` line whose scope changed:
   - visual: a screenshot of the lab, or a short recording for motion.
   - npc: run the cases on the real model, save the transcript, and read the replies yourself.
   - pet: run Teach and Prove, save the result.
   - network: two tabs or bots, save the numbers.
4. Save proof in `docs/testing/proof/<scope>/`. Replace old proof. Keep files small.
5. Mark `[x]` with a proof link, or `[!]` with a reason and a `docs/BUGS.md` entry under that scope. Never mark `[x]` from reading code.
6. Report about 8 lines: passed, failed, what the user should judge, the lab link.
