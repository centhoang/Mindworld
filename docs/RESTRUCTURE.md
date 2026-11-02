# Restructure plan (approved 2026-11-02)

Branch: `rework/fresh-look`. One session, one scope. Project skills: `scope-check`, `scope-publish`.

## Context
You chose: a glyph spike, chat tiers with cloud during the event, and a compact world that shows off NPC and pet minds. Everything else goes to the backlog. The deadline is Nov 4, 9 PM ET, which is **Nov 5, 9 AM in Vietnam**, so just under 3 days. Goal: at every step the game still runs, and you review one scope at a time without playing the whole game. Fallback: `main`, the current live build.

Findings that shape the plan:
- **Clean:** `mind/`, `life/`, `sim/`, `world/` import only `pixel/tiles` from the drawing code, so `TileMap` can just move.
- **Tangled:** `pixel/overworld.ts` (1,444 lines) mixes state with `draw()`. `pixel/main.ts` (1,056 lines) is module-level singletons: chat, fights, room wiring.
- **Labs are easy to serve:** add HTML entries to Vite's `rollupOptions.input`. The Worker's assets folder serves them behind Access.

## Scope after cuts
- **Keep:** villagers, chat, promises, memory, bonds, jobs, economy; market stall; pet hatch, follow, moods, Teach, Prove; wild pets with varieties, taming; player duel; farm, fishing, coins; dance, soccer, picnic activities; a minimal house: outside, one room, bed; 2+ players.
- **Backlog, removed from play:** boss, ghosts and the ghost stone, furniture editing, windmills, decorative fields, sea life, terraces, streams, beaches, cliffs, clouds, in-between grounds, ghost grounds, themes, voice teaching, babble, soccer as a mini-game. Delete with a list in `docs/game/design.md`, so git keeps them. Wait until step 6, so cuts can't break earlier work.
- **World:** one hand-authored village map, about 64 x 44 tiles, as text rows in a new `client/src/world/village-map.ts`. Places: plaza, stall, dance floor, pond, wild meadow, board. Player plots (house + farm) sit along a street, 12 slots. Extra players are guests with no plot. Stretch: street grows by repeating a strip.

## Work order
| # | Task | Gate |
|---|---|---|
| 0 | **Docs:** fix the deadline, record decisions in `RESTRUCTURE.md`, `design.md`, `npc.md`, `visual.md`. Change the `LOCAL_ONLY` rule in `CLAUDE.md` to allow cloud free talk | Done |
| 1 | **3B bench:** tuned 3B vs tuned 1B on `checks/npc.md`, native GGUF, free | Numbers in `ai/npc.md`; 3B tier in only if clearly better |
| 2 | **Glyph spike:** one screen (villager, pet, farm, chat bubble), reading a fake scene. Standalone, no game wiring | **You judge an image and a clip.** Yes: step 5. No: compact Sunnyside. Time box: half a day |
| 3 | **Seams:** mechanical moves only | Tests pass, game plays the same, deployed |
| 4 | **Labs:** `/lab/npc`, `/lab/pet`, `/lab/net`, `/lab/visual` | Each opens alone behind Access |
| 5a | **NPC:** chat tiers, bugs 11-12 | `checks/npc.md` clear |
| 5b | **Network:** AOI | `checks/network.md` clear |
| 5c | **Visual:** glyph view, compact village | `checks/visual.md` clear |
| 5d | **Pet:** Teach, Prove and varieties in the lab | `checks/pet.md` clear |
| 6 | **Wire and cut:** full game, deletions, drop `/api/chatlog` and its KV rows | `checks/game.md` clear, 2+ players |
| 7 | **Submission prep:** demo script, README, numbers | You record, publish and submit |

Do 5a first: NPCs matter most. 5b, 5c and 5d touch separate folders, so you can open one session each. Order: Nov 2: 0-3. Nov 3: 4, 5a, 5b. Nov 4: 5c, 5d, 6. Nov 5 morning (VN): 7 only, no features.

## As built (steps 3-4)
- `PixelView` still reads the Overworld for its sprites. Only `GlyphView` needs to read `Scene` alone; PixelView is the fallback.
- `View.draw` returns which bubbles were held, because a bubble's time on screen depends on that.
- `fight-flow.ts` lives in `pixel/`: it is battle-screen code.
- 5a goes in `makeVillagerAnswer` (`game/chat-flow.ts`), which `/lab/npc` already uses. 5b reads its numbers from `/lab/net`.
- `/lab/visual` shows the spike until 5c adds scene presets.

## As built (5a)
- Cloud tier lives in `NpcVillage.reply` through the `cloud` hook, set in `attachMinds`, so relayed questions use it too. Wild pets use it through `wildAnswer`.
- A player's "Wanna dance?" is now an invitation and replaces an open offer. `/lab/npc` logs bubbles: a pitch may be what "yes" answers.
- Worker quota: 120 per client, 3000 a day. `MIND_MAX_TOKENS` 800, since 500 cut off a reply.
- With no local model, `LOCAL_ONLY` still shows "[local model gave no line]" on greetings: step 7 must turn it off.

## As built (5b)
- `npcs` keep their last spot on a client once out of view, and refresh on entering a cell.
- `scripts/net-bots.mjs` and `scripts/net-check.mjs` run on the live room. Close a run cleanly: leftover sockets fill the room for 90 s.
- 5c: cells assume 1 unit = 1 tile. A 64 x 44 village is about 4 x 3 cells, so most players share a view there.

## Step 3: seams
- Move `TileMap`, `T` and `tileAt` from `pixel/tiles.ts` to `world/tilemap.ts`. Leave a re-export until the imports are fixed.
- Add `client/src/game/ports.ts` with three interfaces:
  - `View`: `draw(scene, g, w, h, t)`.
  - `Transport`: the part of `LiveLink` used by `main.ts`.
  - `MindBackend`: reuse the scheduler's existing backend shape.
- Add a `Scene` type: plain read-only data, covering map, people, pets, props, bubbles and tags.
- Split `Overworld.draw()`: a `buildScene()` that stays with the state, and a `PixelView` that takes the drawing code.
- Move chat, fights and room wiring out of `main.ts` into `game/chat-flow.ts`, `game/fight-flow.ts`, `world/room-flow.ts`, taking dependencies as arguments. `main.ts` becomes wiring.
- No behaviour changes. One move per commit. Reuse `world/live.ts` as the real `Transport`.

## Step 4: labs
- `client/lab/{npc,pet,net,visual}.html`, added to `rollupOptions.input`. Each starts one scope with fakes from `client/src/lab/`.
- `lab/npc`: real scheduler and `WebLlmVoice`, a tiny stage, a fake `Transport`.
- `lab/visual`: fixed scene presets, no model or room.
- `lab/net`: real room, dots for a view, a live readout of messages and bytes per second.
- `lab/pet`: `pixel/teach.ts` flow with a fake world.
- Use `scope-publish` and `scope-check`. Add a rule check that a scope imports only `ports.ts`, never another scope.

## Step 5a: chat tiers
Add a `chatTier()` in `game/npc-chat.ts`, used by `villagerAnswer` / `villagerMind` in `main.ts` (around lines 271-295):
1. Sim answers (`directions.ts`, `offers.ts`, `scene.ts`).
2. Cloud Muse Spark for free talk through the existing `/api/chat`, `askNpc` and the ledger cap.
3. Local tuned 1B when the cap is hit or the network fails. Step 1 kept the 3B out.

- Add `CLOUD_CHAT` beside `LOCAL_ONLY` in `game/test-mode.ts`, so minds stay local and only free talk goes to the cloud. Off leaves the game working.
- Cloud prompts aren't frozen, so give them memories and persona. Local prompts stay frozen at af455c4.
- Keep the replies short, with the typing delay from `mind/human.ts`.
- Bug 12: drop memory lines from invitations in `cleanReply`.

## Step 5b: AOI
- New `worker/src/aoi.ts`: pure, per `docs/network/network.md`. 16-tile cells, 3 x 3 subscription, 4-tile margin. Unit tested.
- `room.ts`: add out target `to: "near"`, and send `pos`, `pose`, `npcs`, `farm`, `emote`, `say`, `mind` through it. Join, leave and host changes stay global.
- 200 ms per-peer tick batching, keeping only the newest position per entity.
- Snapshot on entering a cell, drop on leaving. Client handles enter and leave in `world/live.ts`.
- Raise `ROOM_MAX_PEERS` only after the load test. New `scripts/net-bots.mjs`, N sockets with a hard limit, reporting bytes per peer. Check Cloudflare's Durable Object limits first.
- A compact village means crowding at the plaza, so lower the rate for far entities past ~16 in view.

## As built (5c so far): the look is now the mosaic plane, Tile skin
- `client/src/view/mosaic/`: `grid.ts` (plane, repaints changed cells), `compose.ts` (Scene to cells, pure, tested), `mosaic-view.ts` (canvas). 3 cells per tile, 24 updates a second.
- Default in the game; `?look=pixel` is the old view. Low-res target is 360 rows, about 45 rows of cells. Goals, menus, toasts and the inspector are cells, through `Scene.panels`.
- Still breaks the one-plane rule: battle and house screens (pixel art), DOM chips (Goals, Map...), DOM chat box. Chat box plan: keep the input hidden, show its text in a panel.
- House not checked at the new size: the tour stopped short of the door. Battle draws fine, in the old look.
- Scene gained nothing the view may not read: inspector text comes as `lines()`, bubbles moved to `view/bubbles.ts`.
- Next, the village: `generateWorld` has about 45 uses in `overworld.ts`, grounds need `p.ground` (36x28, too big for a street plot). Plan: keep platform ids, place them on one map from `world/village-map.ts`, skip islands and bridges.
- Delete at the end of 5c: `view/glyph/spike.ts`, `view/mosaic/{spike,skins}.ts`, `glyph-spike.html`, `mosaic-spike.html`, `spike-compare.html`. Keep `glyph/atlas.ts`. Point `/lab/visual` at MosaicView presets.

## Step 5c: glyph view (original plan, read as mosaic)
- `client/src/view/glyph/`: code-drawn glyph atlas, palette, `GlyphView` implementing `View`. Keep `layers.md` bands, foot sort and whole-pixel scaling, reusing `lowSize`.
- Must-draw list only (`docs/visual/visual.md`). Genes map to a pet's glyph face and colour.
- Author the village map here and switch `generateWorld` over. Check NPC routes, `directions.ts` and hosting against it.
- Then archive `tile-rules.md` and `style.md`, write a one-page glyph sheet, and remove pack art from the build.

## Verification
- Every step: `npm --prefix client test`, `npm --prefix worker test`, tsc, secrets scan, local commit.
- Scope gates run on the deployed build through `scope-check`, with proof in `docs/testing/proof/<scope>/`: images and clips for visual, transcripts read by me for chat, numbers for network.
- You judge the lists. Whole-game play-test comes last, with 2+ players.

## Fallbacks
- Spike fails or 5c runs late: keep Sunnyside, `PixelView`, compact map.
- AOI late: ship cells and batching without snapshots, peers capped at 24.
- Step 3 runs past a day: stop splitting `main.ts`; labs use only what's split.
- Chat quality comes first if time is short.
