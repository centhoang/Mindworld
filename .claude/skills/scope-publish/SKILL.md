---
name: scope-publish
description: Put one scope's lab live behind Access so the user can review it alone. Use when the user says "publish <scope>" or after a scope's checks pass.
---

1. Run the tests for what changed, then a secrets scan. Commit locally.
2. Deploy (standing approval): `npm --prefix client run build`, then `npx wrangler deploy` inside `worker/`.
   A lab shares the deployed build, so note if the release changes the other scopes.
3. Open the lab URL (`/lab/<scope>`, or `/` for game) in the test Chrome and confirm it starts with no console errors.
4. Give the user the lab link and the checklist path. Nothing outside Access: game, repo and HF stay private until submission day.
