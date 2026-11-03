# HANDOFF: Mindworld rework (2026-11-03 day)

**Starting prompt:** "Read HANDOFF.md and docs/plan/final-input.md. Make the final plan in plan mode, then execute it. Follow CLAUDE.md."

## Morning report
2026-11-03 day, live `main-CaH4vzcS`, committed locally, not pushed. API spend today about $0.10.
Chat: Muse Spark answers villagers on live, per-client cap gone, $30/day cap kept; chat-log failures fixed (`proof/npc/chatlog-2026-11-03.md`).
Visual: roof relaid, no loose rod, paths clean, tilled farm soil, no walking on water, old sprites gone (bugs 38-41, 44).
Earlier: bugs 30-33, 35, hatch line. Open: 37 (dance never seen). User's call: 34 (speech box over Goals), 36 (Brain panel names model).
Ready for the user's play-test.

## State
- Branch `rework/fresh-look`, not pushed, live at https://pets.uryto.dev/, see `wrangler deployments`. Fallback: `main`, the last pixel build.
- Tests: client 609, worker 209, tsc clean. `LOCAL_ONLY` is on. Credits: Meta ~$149.9, Modal ~$100.
- Docs index `docs/README.md`, plan `docs/RESTRUCTURE.md`. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`, chat, room and fight flows.
- User has not reviewed bugs 13-23. Two tabs driven on live (`proof/game/2-players.md`); no 2-person play yet. Labs still use the mosaic. Tuned 3B stays out.
- 5b: AOI live, 89 bots held; 100 not proven.

## Decisions
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. Local prompts are frozen at af455c4: a text change needs a retrain. Cloud `VILLAGER_STYLE` is not frozen.
- The user tests only once the whole plan is executed. Until then, run the checks and record proof; do not stop for review.
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows.
- Chat: tiers, with cloud free talk during the event. World: one compact village. Deadline in Vietnam: Nov 5, 9 AM. Steps: `docs/RESTRUCTURE.md`.
- Pack rules (user): a human activity with no matching pack animation is dropped. Everything is top-down, front side only, never iso (`docs/visual/visual.md`).

## Next actions
1. In progress in the previous session: bugs 45-48 (remove 3 props, same small houses with interiors, stuck after first house exit, wild pets stuck).
   If that session reported them done, they are in `docs/BUGS.md` under Fixed; otherwise include them in the plan.
2. Final plan, in plan mode, from `docs/plan/final-input.md` (the user's demo target and asks, with facts for the planner). Then execute it.
3. User's calls still open: bugs 34, 36. Step 7 runs last, Nov 5 morning: `LOCAL_ONLY` off for the rest, `/api/chatlog` removed.

## Gotchas
- A deploy can take from minutes to 15+ min to show on the site, while wrangler says it is active. Check the `main-` file in `/`; do not redeploy for that.
- Tool how-to (test Chrome, tab driving, chat log): `docs/ops/tooling.md`. Start the test Chrome as a background job or it closes. Drivers: `.scratch/chk/{acts,talk,final}.mjs`.
- pets.uryto.dev answers 200 from this home network only. Deploy: `npx wrangler deploy --cwd worker`, check the output says `pet-mind`. If `wrangler.jsonc` appears at the root, delete it.
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app}.ts
