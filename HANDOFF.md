# HANDOFF: Mindworld rework (2026-11-03)

**Starting prompt:** "Read HANDOFF.md. Continue from Next actions. Follow CLAUDE.md."

## Morning report
Sunnyside is the game's look (user, 2026-11-03); the mosaic stays in the code at `?look=mosaic`, set aside.
Done: home wing same outside and in, villagers have their own homes and go in to sleep and eat, picnic and feed dropped.
Free talk tested on the real model (`proof/npc/5f-free-talk.md`): good, and it stays cool after insults (bug 28 fixed).
Open: bugs 30-33 (Codex rework, Next action 1). Report of dropped activities: `proof/game/activities.md`.

## State
- Branch `rework/fresh-look`, not pushed, live at https://pets.uryto.dev/, see `wrangler deployments`. Fallback: `main`, the last pixel build.
- Tests: client 590, worker 207, tsc clean. `LOCAL_ONLY` is on. Credits: Meta ~$149.9, Modal ~$100.
- Docs index `docs/README.md`, plan `docs/RESTRUCTURE.md`. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`, chat, room and fight flows.
- User has not reviewed bugs 13-23. Two tabs driven on live (`proof/game/2-players.md`); no 2-person play yet. Labs still use the mosaic. Tuned 3B stays out.
- Scope checks ran on the mosaic: Sunnyside was only spot-checked. 5b: AOI live, 89 bots held; 100 not proven.

## Decisions
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. Local prompts are frozen at af455c4: a text change needs a retrain. Cloud `VILLAGER_STYLE` is not frozen.
- The user tests only once the whole plan is executed. Until then, run the checks and record proof; do not stop for review.
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows.
- Chat: tiers, with cloud free talk during the event. World: one compact village. Deadline in Vietnam: Nov 5, 9 AM. Steps: `docs/RESTRUCTURE.md`.
- Pack rules (user): a human activity with no matching pack animation is dropped. Everything is top-down, front side only, never iso (`docs/visual/visual.md`).

## Next actions
1. Codex rework, bugs 30-33: audit every file in `client/public/art/gen/` against the angle rule, send failures back, redo pet head shade and remove spots.
2. `scope-check` visual, pet, game on Sunnyside live, including night, door wipe, chat box, walking in the first hold after a teleport.
3. Confirm "want a picnic?" on live once the chat cap resets (120 lines a day per client, used up 2026-11-03).
4. Left in `game.md`: stranger test (a person), Teach and no-GPU (need step 7).
5. Nov 5 morning: step 7 only. It must turn `LOCAL_ONLY` off. `/api/chatlog` goes last.

## Gotchas
- A deploy can take from minutes to 15+ min to show on the site, while wrangler says it is active. Check the `main-` file in `/`; do not redeploy for that.
- Tool how-to (test Chrome, tab driving, chat log): `docs/ops/tooling.md`. Start the test Chrome as a background job or it closes. Drivers: `.scratch/chk/{acts,talk,final}.mjs`.
- pets.uryto.dev answers 200 from this home network only. Deploy: `npx wrangler deploy --cwd worker`, check the output says `pet-mind`. If `wrangler.jsonc` appears at the root, delete it.
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app}.ts
