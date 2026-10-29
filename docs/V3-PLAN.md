# v3 plan: a village of players' grounds, run by local minds

Status: **approved 2026-10-29** (decisions 1-3 = a). Input: `docs/V3-BRIEF.md`.
Time: 4 build days (Oct 30 – Nov 2), Nov 3 = repo public + demo capture, Nov 4 9 PM ET = submit.

## 1. Pitch the plan is tested against
"Every mind in this village runs on the players' own machines. Watch two pets plan a picnic, invite a friend and talk about it,
while the Elder is hosted by another player's laptop." Judge value: Impact (a living world that grows with players), Meta AI
(Llama 3.2 runs every mind locally; Muse Spark teaches and is the fallback), Demo (visible plans, memories, talk), Tech depth
(distributed mind hosting with handover, deterministic sim + model chooser).

## 2. Research findings (short)
**Local model reach.** Measured on the dev GTX 1050 (docs/SPIKES.md): Llama 3.2 1B q4f32 in WebLLM: prefill ~97 tok/s, decode
~27 tok/s, warm load 3.3 s, cold 29 s incl. download, grammar mode 100 % valid. Published: ~67 tok/s on an M3 Pro, a 20–60 tok/s
range on common laptops; no reliable Intel iGPU number, so assume 10–25 tok/s and **measure at runtime** (a 2 s probe on load).
Download ~0.7–0.9 GB, VRAM ~0.9 GB. No WebGPU (old Linux/Intel, Firefox without the flag) → no local model.
**One engine for all minds.** WebLLM locks each loaded model to **one request at a time** (`loadedModelIdToLock` in
`engine.d.ts`), so a single engine per machine serving every hosted mind through our own priority queue is the right design (and
the only one that fits in VRAM). Grammar (`response_format: {type: "grammar"}`) and JSON schema work in the browser; we already
use grammar. Each mind's prompt differs, so there is no KV reuse across minds: budget re-prefill for every call.
**Budget per call (GTX 1050):** choose activity (~200 in / 6 out, grammar) ≈ 2.3 s · one dialogue line (~300 / 30) ≈ 4.2 s ·
day plan (~250 / 60) ≈ 4.8 s · emote (grammar) ≈ 2 s · bedtime reflection (~350 / 40) ≈ 5 s. Per mind per in-game day
(12 real minutes): 1 plan + ~8 choices + ~6 lines + 3 emotes + 1 reflection ≈ **60 s of GPU, ~8 % duty**. At a 50 % duty cap one
GTX-1050-class machine hosts ~6 minds; a faster laptop hosts more. GARP runs 20 agents on one big GPU; we spread them over players.
**Fallback, said honestly:** no WebGPU → choices from the deterministic utility score (the sim never needs the model), lines from
Muse Spark (`/api/petchat`, under the existing `MAX_DAILY_USD` cap), then scripted. Every bubble/inspector shows the source:
"Llama 3.2 1B · on Kai's laptop", "Muse Spark · cloud", "scripted".
**Tuned model in the browser** stays blocked (MLC conversion failed 4 ways, FINETUNE.md step 6). So the browser runs the stock 1B
with persona prompts + grammar; a tuned model reaches power mode (llama.cpp) only, unless one more MLC try succeeds.
**Room limits.** `ROOM_MAX_PEERS = 24`, `ROOM_MAX_MSG_BYTES = 4096`, token-bucket rate limits and strikes already exist
(`worker/src/room.ts`). DO storage values are fine for per-NPC state (keep each ≤ 16 KB). Local save grows by a ground seed +
mind logs (~3 KB per mind).

## 3. Scope and cut line
**Above the line (ships for the Nov 3 demo)**, in build order:
1. Needs + activities sim (pets and humans), poop + cleaning, in-game day/night clock. Pure TS, tested.
2. Limb rig: walk with arm swing, still idle with a breathing bob, poses (sit, lie/sleep, kick, dance, fish, eat).
3. Minds: persona card, daily plan, choose-activity, emote, reflect, memory log + facts, relationships; one local engine + queue;
   **Mind inspector** (click a mind: persona, today's plan, last memories, friends, "running on ..."). Judges must see this.
4. Grounds world: your ground (unique seeded shape + theme) where you spawn, players' grounds on a ring around the shared hub,
   ghost-ground leave policy, in-between grounds by rarity (playground + picnic hill + fishing pond at least), 3 themes.
5. Networked minds: mind-to-mind talk across machines, 3 village NPCs + the Elder hosted on players' machines with handover,
   invitations that spread (the picnic/party demo beat).
6. Codex static art for the 3 themes + props; Claude animates/recolors.
**Below the line (after the event unless time is left; user 2026-10-29: extra themes and real mini-games come first in this backlog):** themes 4–5 (beach, night) as recolors, party plaza + event ground as
in-between types, load-based rebalancing (we only hand over on join/leave/timeout), fishing/soccer as real mini-games (above the
line they are timed animations with outcomes), outdoor plot decor port, mobile touch controls, tuned 1B in the browser (MLC),
server-persisted grounds.
**Frozen (no new work):** duels, boss, market, Teach, farm. They stay as they are.

## 4. Architecture
### 4.1 Sim (pure, deterministic, tested first) — `client/src/sim/`
- `clock.ts`: 1 game day = 12 real min; phases morning/noon/evening/night (tint in the renderer).
- `needs.ts`: `Needs = {hunger, energy, fun, social, hygiene, bladder?}` in 0..100, decay per game hour by species/kind;
  `urgency(needs)` → sorted list.
- `activities.ts`: `ActivityDef = {id, who: "pet"|"human"|"any", place: "home"|"house-corner"|"playground"|"picnic"|"pond"|"any",
  min, max (participants), dur, effects: Partial<Needs>, object?, pose, makes?: "poop"|"trash"}`. Pet: eat, sleep, poop, play-ball,
  soccer, picnic, dance, nap-corner, groom. Human: fish, picnic, soccer, dance, cook, eat, clean (removes poop/trash),
  feed-pet, read-corner, sleep. Multi-participant activities hold a "gathering" (place, start, joined ids).
- `agent.ts`: state machine idle → walk-to → doing → done, path on the tile grid, `validChoices(agent, world)` (like
  `allowedMoves`: only activities whose place is reachable, objects free, participants possible) and `utility(choice)` (needs
  urgency × effect + plan bonus + affinity bonus). **The model only ever picks from `validChoices`; utility is the fallback.**
- `relations.ts`: affinity −100..100 per pair, changed by shared activities, talk tone, gifts; `friends(id)`.
### 4.2 Minds — `client/src/mind/`
- `persona.ts`: plain-text card (name, species/role, 3 traits, 2 hobbies, a habit, a short background). Pets: derived from genes +
  the player's Teach memo (so the coach work feeds personality); NPCs: authored cards (Elder, Fisher Mo, Cook Ama, Kid Pip).
- `memory.ts`: rolling log (30 entries, "08:10 ate berries with Sprig") + ≤ 6 facts (from bedtime reflection) + today's plan.
  Saved in the local save for your pets; for NPCs in the room DO (so a host change is seamless).
- `brain.ts`: decision kinds `plan | choose | line | emote | reflect`; prompt builders (persona + 5 relevant memories +
  relationship + situation, ≤ 700 tokens); grammars built from `validChoices` / emote list; output validated, else fallback.
- `scheduler.ts`: one engine, one priority queue (player-facing > conversation > choose > emote > plan/reflect), deadlines
  (a choice older than 8 s → utility fallback), duty cap 50 % from the measured tok/s, `capability()` = {webgpu, tps, load}.
- Backends reuse `game/voices.ts` (WebLlmVoice, NativeVoice for power mode, CloudVoice) behind a `MindBackend` interface.
- Conversations: when two minds are near, both idle-ish and `social` is low, the initiator's host asks for an opener; each side's
  host generates that side's lines (2–4 turns, ≤ 20 words, typing "..." bubble while queued). The topic comes from memories
  ("the picnic tomorrow"); the outcome updates affinity and both logs. A line may carry an invitation (activity, place, time):
  the receiver's brain accepts/declines from affinity + plan, and accepted invites enter the plan; this is how a party spreads.
### 4.3 Grounds world — `client/src/world/`
- `ground.ts`: `groundFromSeed(seed)` → tile mask (radial noise blob ~26×20 tiles, smoothed, one connected land), 4 gate points
  (N/E/S/W), theme (meadow/autumn/snow, later beach/night), prop placement (seeded, keeps paths clear). Your seed is made once
  and saved; same seed → same ground on every client.
- `layout.ts` (rework): hub = shared places (event, market, Elder, wild, boss) as today; player grounds on slots of a ring around
  the hub (slot = the server's `corner` index, extended to 24); bridges from each ground's gate to the nearest hub/neighbour gate.
  Between two occupied neighbour slots an **in-between ground** may appear: `roll(roomSeed, slotPair, gameDay)` with weights
  playground 30, picnic hill 25, fishing pond 25 (later: party plaza 15, event 5). Deterministic, so clients agree without
  extra messages.
- Join: server sends `welcome {corner, roomSeed, peers (+groundSeed, theme)}`; you spawn on your own ground. Leave policy
  (recommended): the ground stays as a **ghost ground** for 10 min (dimmed, the owner's pet asleep, read-only), then the slot
  frees and the next roll may place an in-between ground there.
### 4.4 Room protocol additions — `worker/src/room.ts` (validated + rate-limited like duels, tested)
Client → server: `hello` gains `{groundSeed, theme, cap: {webgpu, tps}}`; `cap {tps, load}` (≤ 1 / 10 s);
`mind {who, act?, say?, emote?, invite?, mem?}` where `who` = one of my pets or an NPC I host. Server → clients:
`npcHost {npc, host}`, `npcState {npc, state}` (to the new host only), relayed `mind` events, `ghostGround {slot, until}`.
Rules: only the owner (pets) or the current host (NPCs) may speak for `who`; `act` must be a known activity id; `say` cleaned
≤ 120 chars, ≤ 1 per 3 s per mind; positions speed-checked; `mem` ≤ 120 chars, appended to the DO's NPC log (cap 30).
Host election: score = tps × (webgpu ? 1 : 0.1) / (1 + hosted). On join/leave or 15 s without a host heartbeat, the server
reassigns and sends the stored state. A non-WebGPU player still hosts (scripted/cloud brain), so no server-side AI is needed.
### 4.5 Animation (Claude, code) — `client/src/pixel/art.ts`
Limb rig per direction: shoulders + hips anchors on the ImageGen body (hat-to-hips stays from the sheet); arms are 1–2 px
lines + a hand pixel, swinging opposite to the legs (front: alternate up/down; side: forward/back). Idle = frame 0 standing
still + a 1 px breathing bob every ~1.2 s and a blink. Poses are offset tables (sit, lie, kick, dance arms up, fish arm forward +
rod, eat hand-to-mouth). Pets (procedural from genes): squash/stretch + offsets for sleep, eat, dance, poop.

## 5. Art list for Codex (static only; Claude reviews against STYLE.md, recolors, animates)
Batch 1 (meadow, stage 4): grass base ×3 variants, path, shore/edge masks per STYLE.md, tree, bush, rocks ×2, flowers ×3, fence,
bench, soccer goal + ball, picnic blanket + basket, fishing dock + rod, pond water tile, food bowl, poop, trash bag, party
lights, 3 NPC human body bases (4 directions, frame 0 only). Batch 2: autumn + snow ground tiles and tree variants
(other props are recolored in code). Held items: fish, sandwich, broom, ball.

## 6. Costs
- Live play: **~$0** (local minds). Cloud fallback already capped by `MAX_DAILY_USD`; the demo uses local minds.
- Optional "village mind" data + multi-task fine-tune (coach + village tasks, Llama 3.2 3B and 1B, power mode): ~2,000 teacher rows
  from Muse Spark Open at ~$0.002 → ~$4, plus ~$2 of Modal H100 (the coach run cost ~$1.5) → **~$6 total**, run through the
  existing cost-capped scripts with ledgers. Credits left: Meta ~$149.91, Modal ~$110.
- Codex art: the user's ChatGPT quota, $0.

## 7. Stages (each ends with a play-test ask)
| # | When | Build | Play-test ask |
|---|------|-------|---------------|
| 1 | Oct 30 | sim (clock, needs, activities, agent, relations) + tests; limb rig (arm swing, idle, poses); residents use the sim at home, poop + cleaning | watch your pets live a day at home; walk/idle look |
| 2 | Oct 30–31 | mind (persona, memory, brain, scheduler) on local 1B with fallbacks; Mind inspector; emotes; local pet-to-pet talk | open the inspector, change a trait, see the plan change |
| 3 | Oct 31–Nov 1 | grounds: seeded shapes, ring layout, own spawn, ghost grounds, in-between grounds, themes by recolor; Codex batch 1 | two tabs: two grounds join, leave → ghost |
| 4 | Nov 1–2 | networked minds: cross-machine talk, NPC villagers + Elder hosted with handover, invitations → picnic | two tabs/machines: picnic invite spreads; close the host tab, the Elder moves |
| 5 | Nov 2 (background from stage 3) | optional village-mind data + fine-tune (power mode); Codex batch 2 | power mode: tuned minds |
| 6 | Nov 2–3 | VFX polish, README credits, 3-min script, CRT-on captures, deploy, repo public (user) | final run-through |
Slip rule: if a stage runs late, cut from the bottom of its own list first, then the next item below the line; stages 1–4
together are the demo, so stage 5 and art batch 2 go first.

## 8. Risks and fallbacks
- 1B dialogue is bland/repetitive → short lines, persona + memory in the prompt, temperature 0.8, a repeat filter, cloud line
  under the cap as fallback (labelled). The sim never depends on the model.
- Queue saturation on weak GPUs → measured tok/s caps duty and hosted minds; deadlines fall back to utility.
- Protocol bugs/abuse → server tests like the duel suite; owner/host checks; strikes.
- WebGPU missing on a judge's machine → the world still lives (utility + cloud/scripted lines) and says so in the inspector.
- Time → the cut line above; duels/boss/market frozen.

## 9. Decisions for the user (max 3)
User 2026-10-29: **all three = (a), plan approved.** Stage 5 fine-tune (~$6) is approved.
1. **Model.** (a, recommended) one stock Llama 3.2 1B per machine serves every mind (pets + NPCs) with persona prompts and
   grammar; a multi-task LoRA (coach + village) for power mode only as optional stage 5 (~$6). (b) No new fine-tune at all.
   (c) Two separate LoRAs (pet / village): twice the downloads, no browser benefit while MLC is blocked.
2. **Ground leave policy.** (a, recommended) ghost ground for 10 min, then the slot is freed for an in-between/new ground.
   (b) despawn at once (simplest, world shrinks visibly). (c) persist grounds on the server (more storage, below the line).
3. **Scope room.** (a, recommended) freeze duels/boss/market/Teach and move mobile controls + outdoor decor below the line.
   (b) keep mobile touch controls above the line (~half a day; then only playground + picnic as in-between grounds).
