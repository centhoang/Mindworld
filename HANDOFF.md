# HANDOFF: Mindworld rework (2026-11-02)

**Starting prompt:** "Read HANDOFF.md. Continue from Next actions. Follow CLAUDE.md."

## Morning report
Done: bug 25 fixed and proven on live (`proof/game/walk-steady.md`). Live scope checks, NPC rude and gossip, 2-player game run.
Bug 26 was machine load, closed. Bug 27 explained, images retry. Three new `game.md` lines ticked.
Birthday promise proven on live, kept and broken (`proof/game/birthday.md`); decor added. Live version 1c63930a.
Decisions for the user: bug 28, small talk stays warm after insults; a fix needs prompt text and a retrain (frozen prompts).
Bug 29: villagers never clean or feed, so the activities line stays failed (`proof/game/activities.md`).

## State
- Branch `rework/fresh-look`, not pushed, live at https://pets.uryto.dev/ (see `wrangler deployments`). Fallback: `main`, the last pixel build.
- Tests: client 600, worker 207, tsc clean. `LOCAL_ONLY` is on. Credits: Meta ~$149.9, Modal ~$100.
- Docs index `docs/README.md`, plan `docs/RESTRUCTURE.md`. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`, chat, room and fight flows.
- User has not reviewed bugs 13-23. Two tabs driven on live (`proof/game/2-players.md`); no 2-person play yet. Steps 0-5d deployed. Labs live: `/lab/npc`, `/lab/pet`, `/lab/net`, `/lab/visual`. Tuned 3B stays out (`docs/ai/npc.md`).
- 5a: cloud free talk works (`proof/npc/`). 5b: AOI live (`proof/network/`), 89 bots held; 100 not proven.
- 5c, 5d built: village, one plane on every screen, as built in `docs/RESTRUCTURE.md`. Live scope-check done. Bug 24 fixed, unit test only.

## Decisions
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. Prompts are frozen at af455c4: a text change needs a retrain.
- The user tests only once the whole plan is executed (2026-11-02). Until then, run the checks and record proof; do not stop for review.
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows.

## Decisions from the user (2026-11-02)
- Look: mosaic plane, Tile skin (not the glyph spike). Chat: tiers, with cloud free talk during the event. World: one compact village that shows NPC and pet minds.
- Deadline in Vietnam: Nov 5, 9 AM. Cut list and all steps: `docs/RESTRUCTURE.md`.

## Next actions
0. User picks the look: mosaic or compact Sunnyside (`?look=pixel`, `Look` chip, live on b2b8821f). The winner stays, then drop the chip.
1. User plays the live build; read the chat log after, add failures to `checks/npc.md`. User decides bugs 28 and 29.
2. Left in `game.md`: stranger test (a person), Teach and no-GPU (need step 7).
3. Nov 5 morning: step 7 only. It must turn `LOCAL_ONLY` off. `/api/chatlog` goes last.

## Gotchas
- A deploy can take from minutes to 15+ min to show on the site, while wrangler says it is active. Check the `main-` file in `/`; do not redeploy for that.
- Tool how-to (test Chrome, tab driving, chat log): `docs/ops/tooling.md`.
- pets.uryto.dev answers 200 from this home network (approved bypass); other IPs get 403. Deploy as one plain command: `npx wrangler deploy --cwd worker`, and check the output says `pet-mind`. A bare deploy from the root publishes all of `client/` to a public workers.dev Worker (happened 2026-11-02, deleted). If `wrangler.jsonc` appears at the root, delete it.
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app}.ts
