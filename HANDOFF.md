# HANDOFF: Mindworld rework (2026-11-03, after the night shift)

**Starting prompt:** "Read HANDOFF.md. Continue from Next actions. Follow CLAUDE.md."

## Morning report
Done overnight, live as `main-Dp6B-Vqo`, committed locally, API spend $0: bugs 30-33 (goal and slide redrawn front-on, round head shade, spots gone).
Hatch line stays through the hatch. All 654 gen art files audited: `proof/visual/gen-art-audit.md`.
Scope checks visual, pet, game ran on live Sunnyside: `proof/game/sunny-live.md`. Picnic is no longer offered; chop proven.
Still open: dance never started in 28 min of watching (bug 37, no defect found); the chat cap reset itself was not tested.
Needs you: bug 34 (speech box over Goals panel), bug 36 (Brain panel names the model to a stranger). A 2-person play is still not done.

## State
- Branch `rework/fresh-look`, not pushed, live at https://pets.uryto.dev/, see `wrangler deployments`. Fallback: `main`, the last pixel build.
- Tests: client 594, worker 207, tsc clean. `LOCAL_ONLY` is on. Credits: Meta ~$149.9, Modal ~$100.
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
1. User: decide bugs 34 and 36, review bugs 13-23 and 30-33, play with a second person.
2. Bug 37 if time allows: why villagers do not choose dance.
3. Left in `game.md`: stranger test (a person), Teach and no-GPU (need step 7).
4. Nov 5 morning: step 7 only. It must turn `LOCAL_ONLY` off. `/api/chatlog` goes last.

## Gotchas
- A deploy can take from minutes to 15+ min to show on the site, while wrangler says it is active. Check the `main-` file in `/`; do not redeploy for that.
- Tool how-to (test Chrome, tab driving, chat log): `docs/ops/tooling.md`. Start the test Chrome as a background job or it closes. Drivers: `.scratch/chk/{acts,talk,final}.mjs`.
- pets.uryto.dev answers 200 from this home network only. Deploy: `npx wrangler deploy --cwd worker`, check the output says `pet-mind`. If `wrangler.jsonc` appears at the root, delete it.
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app}.ts
