# HANDOFF: Mindworld rework (2026-11-03, end of day session)

**Starting prompt:** "Read HANDOFF.md and docs/plan/final-input.md. Make the final plan in plan mode, then execute it. Follow CLAUDE.md."

## Where things stand
- Live `main-DALkkevO` (worker version 331242a9), committed locally as 6d31703 on `rework/fresh-look`, not pushed.
- Tests: client 610, worker 209, tsc clean. API spend 2026-11-03 about $0.10 (Muse Spark chat tests). Credits: Meta ~$149.9, Modal ~$100.
- The user woke on 2026-11-03 and asked for a **final plan** in a new session (plan mode, then execute there).
  Their full input (demo target, specific asks, facts for the planner) is in `docs/plan/final-input.md`. Read it first.
- Doc size limits are gone (user): write down anything the next session needs, in the doc for that topic (`CLAUDE.md` Docs).

## Done today (all live, in `docs/BUGS.md` under Fixed, waiting for the user's review)
- Chat: villager greetings and free talk go to Muse Spark on live; per-client cap removed; day caps stay
  (`MAX_DAILY_USD = "30"` in `worker/wrangler.toml`, 3000 lines a day, `CHAT_QUOTA` in `worker/src/chat.ts`).
  The chat-log failures and replay are in `docs/testing/proof/npc/chatlog-2026-11-03.md`.
- Visual: roofs in clean pack rows (38), no loose rod (39), paths join cleanly (40), tilled farm soil (41), only Sunnyside character sprites (44).
- 45: bench, slide and food bowl removed. The pet's `eat` activity still targets the old bowl spot (`overworld.ts`, `this.bowl`); it is just not drawn.
- 47: leaving the house put you on a blocked tile (the door column sits on the farm plot's edge). `exitHouse` now picks the nearest open spot.
- 48: wild pets re-pick a reachable target after 0.8 s pressed against something; a wild inside a wall goes home.
- Also: the frame loop schedules itself first and catches errors, the game starts even if a load fails, and `readGpu` gives up after 4 s.
- Earlier today: bugs 30-33, 35, the hatch line, and Sunnyside scope checks on live (`docs/testing/proof/game/sunny-live.md`).

## Open
- 46: same small house for every player, with an interior. Needs small-house interior art; part of the map polish in the final plan (detail in BUGS).
- 37: dance never chosen unforced (28 min watched). The user now asks for a dance floor: see `final-input.md`.
- User's calls: 34 (speech box over the Goals panel), 36 (Brain panel names the model to a stranger).
- Not done by a person: a 2-person play, the stranger test. 100 bots not proven (89 held).

## Decisions (standing)
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. Local prompts are frozen at af455c4: a text change needs a retrain. Cloud `VILLAGER_STYLE` is not frozen.
- Chat answers come from Muse Spark now (user, 2026-11-03), no per-client cap; everything else keeps `LOCAL_ONLY` until step 7.
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows.
- Pack rules (user): a human activity with no matching pack animation is dropped. Everything is top-down, front side only, never iso (`docs/visual/visual.md`).
- Deadline: Nov 4, 9 PM ET = Nov 5, 9 AM Vietnam. Step 7 (`LOCAL_ONLY` off, `/api/chatlog` removed) runs last.

## Next actions
1. Final plan in plan mode from `docs/plan/final-input.md`, then execute it. Include bug 46 in the map polish and bug 37 with the dance floor.
2. After any user play-test: read the chat log unasked and add failures to `docs/testing/checks/npc.md`; log new bugs in `docs/BUGS.md`.
3. Step 7 on Nov 5 morning, last.

## Gotchas
- **A hidden Browser pane stalls requestAnimationFrame**: the game looks frozen and keys do nothing. That is the pane, not the game.
  Check `tabs_context` ("pane is hidden"), or drive by hand: `__px.world.update(0.05, new Set(["arrowdown"]))`.
  `__px.blocked()` shows what holds the keys (mode, door, menus, teach, chat).
- A deploy can take minutes to 15+ min to show on the site while wrangler says it is active. Check the `main-` file in `/`; do not redeploy for that.
- Deploy: `npm --prefix client run build`, then `npx wrangler deploy` inside `worker/`, check it says `pet-mind`. If `wrangler.jsonc` appears at the root, delete it.
- pets.uryto.dev answers 200 from this home network only. Local dev: `.claude/launch.json` `client-dev` (no worker: /api 502s, fine for movement).
- The dev GPU gate asks on first load in a clean profile: pick "This computer only has this graphics chip".
- Tool how-to (test Chrome, tab driving, chat log): `docs/ops/tooling.md`. Start the test Chrome as a background job or it closes. Drivers: `.scratch/chk/{acts,talk,final}.mjs`.
- The untracked `info-ref/` folder is the user's; never commit or touch it.
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app}.ts. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`.
