# Game scope on live, 2026-11-04 (~22:00-22:40 VN)

Live build `main-czFxq799` at mindworld.uryto.dev, room `check`. Player 1 "Brave Pip" (test Chrome, GPU, local model
loaded, hosts all four villagers); player 2 "Bouncy Maple" (a second bench Chrome with `--disable-gpu
--disable-features=WebGPU`, `requestAdapter()` = null). Drivers in `.scratch/chk7/`.

## Teach, then Prove (line 8)
Teach and the Prove card on live: `../pet/scope-check-live-2026-11-04.md` (Muse Spark, 3.4-4.9 s, +1.3 pts).
Duel with a friend: `sunny-live.md`. Duels with Ama on live: the pet notes above.

## Kickabout or dance, alone, others join (line 11)
Player 1 danced on the floor (Dance emote, key 3, every 7 s). The dance runs at noon and in the evening only
(`life/activities.ts`), so the morning and night tries drew nobody. At noon, unforced:
- 70 s: Elder walked over to Pip's kickabout (Pip had started it alone at 380 s of the watch) and played.
- 126 s: Pip came to the floor; 140 s: Ama and Mo too; 154 s: the dance started with Pip, Ama and Mo.
Shot: `dance-join-live.png`.

## Lit floor, campfire, animals (line 12)
- Dance floor lit in its checker while the player dances (`dance-floor-lit-live.png`); plain grey with nobody dancing
  (`../visual/plots-all-live.png`, the square).
- Campfire burning in its ring at 20:30 with Pip, Mo and Elder at it (`campfire-evening-live.png`).
- Pig, cow, sheep and chicken in new places 10 s apart (`animals-amble-live.png`).

## Activity watch (line 9)
In-page watch on player 1, nothing forced on villagers (player 1 only danced on the floor). See the line for the list.
Each villager's first time in each activity, seconds from the start (1398 s = about two game days, evening to evening):
fish mo@1 · cook ama@1, mo@400, elder@497, pip@1351 · campfire pip@1, mo@51, elder@58, ama@718 · wander all ·
sleep elder@126, mo@132, ama@853, pip@853 · sell ama@166 · tend elder@346 · soccer pip@380, elder@548 (joined) ·
mine ama@494, pip@521, elder@619 · haul ama@577, elder@710 · dance mo, ama, pip @613 (the player was dancing) ·
farm elder@1068 · feed elder@1118 · swim pip@1240, elder@1296 · repair elder@1350.
Not in this watch: chop (Pip's noon job; Pip mined and played soccer instead; chop was seen unforced on live before,
`sunny-live.md`). Odd but harmless: Ama sold at the stall at night (04:19).

## No GPU (line 16) and bug 65
Player 2 alone in the room (player 1 closed), hosting all four villagers, `requestAdapter()` = null:
- First visit: no download box, straight into the village (`setup.ts`: no adapter = open).
- "hi! what are you up to today?" to Elder: "Not much. Just taking it easy tonight." in 0.1 s, source `rules`.
- "what is your favourite memory of this village?" to Elder: "That dance we spoke of, warm by firelight..." in 6.3 s,
  source `model` (Muse Spark Open on Baseten); to Mo, after the bug 65 fix: "Chatting with Elder about dancing by the
  campfire this evening, that was really nice." in 2.6 s, `model`.
- Teach on this player: memo updated by Muse Spark in 5.3 s.
- Inspector before the fix: "Last line: the village rules (no model) (B: load Llama)" right after the cloud reply
  (bug 65). After (worker 24fb26ae): Mo's `lineSource` = cloud; Ama: "Last line: from the cloud (Muse Spark Open)",
  `inspector-65-nogpu-live.png`.
- Also seen: a host on the Teach screen froze its villagers for everyone (bug 64, fixed, `../network/bug64-teach-live.md`).
