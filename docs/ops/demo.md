# Demo video: Mindworld (rewritten 2026-11-04 for the final build)

Claude drafts and checks; the user records, uploads and submits. Track: **Indie, Build for Your World**. 3 minutes max,
about 380 spoken words. Lines marked **[USER]** need the user's words or OK. Submission form answers: `submission.md`.
Order of the story (HANDOFF, `game/mission.md`): lead with what is new (browser, shared village, shared local AI,
hand-over, free on any hardware), then show the villagers being alive, then the pet, then the close.

## Video build (2026-11-04 evening): staged, not recorded (user decision)
**User (2026-11-04):** no recording on live. Stage every scene with a script on a local build, write our own lines
(no real AI output), set our own camera, add video-only polish (campfire light etc.), never change the live game.
Claude builds the whole video; the user uploads it (YouTube) and submits.

**How it works.** All tooling is in `.scratch/video/` (gitignored, not part of the product):
- `stage.js`: injected before load. `__vt.on` = virtual clock: the game's rAF loop and intervals stop.
- `director.js`: evaluated in the game tab. Drives the real `Overworld` and its view one frame at a time at 30 fps:
  villagers are puppets (`D.npc(id, pos, act)` uses the sim's own `a.puppet`, pose from the activity table, re-held
  every frame), Kai is `D.me(pos)`, Rin is a peer (`D.peer`/`D.peerTo`/`D.peerPose`), lines are the game's own
  bubbles (`D.say(who, text, secs, to)`, `D.think`), emotes are the pack's UI icons (`D.emote(who, "love"|"stress"|
  "alerted"|"confused"|"attack"|"working"|"chat")`), clock `D.clock(day, hour)`, `rate()` for time-lapse. The world
  draws first, then video-only light (`D.ambient`: golden hour, blue dusk, night multiply, house lights, firelight with
  embers, fireflies, cloud shadows, petals), then bubbles, inspector (real mind state; `D.src` pins "Llama 3.2 1B,
  tuned"), emotes, cards. `s.custom` shots draw anything (battle view, Teach screen, split screen).
- `shots/*.js`: one file per act, each shot `{W, H, dur, setup, frame, cam, fx, ui}` (art px; 480x270 = 4x,
  640x360 = 3x, 960x540 = 2x of 1080p). Cues: `this.q = [[t, fn], ...]` + `D.run(this.q, T)`.
- `shoot.mjs`: `node shoot.mjs load` (reload tab with stage + director + pack emotes + `assets/*.png` + shots),
  `peek <shot> t1,t2 out.png` (contact sheet), `render <shot>` (frames to `frames/<shot>/`, then
  `clips/<shot>.mp4` 1920x1080 nearest-neighbour, crf 16). `shot.mjs` = one screenshot; `cdp.mjs` = CDP client.
- Narration: Kokoro TTS (offline, Apache-2.0, `pip install kokoro-onnx`, model in `.scratch/video/tts/`):
  `python -I tts.py narration.json voice af_heart 1.0` writes `voice/<id>.wav` + `durations.json`.
- Postcards: real Muse Image output cropped from `docs/testing/proof/game/postcard-*-live.png` into
  `.scratch/video/assets/card-fire.png`, `card-win.png`.
- Teach proof number is the game's own `prove()` on 1000 held-out fights: empty memo -> "guard when it winds up a
  heavy hit" = 59% -> 74%, +15.0 pts (shown on the real Teach screen). Do not narrate a different number.

**Stack to run it:** preview_start `worker-mock` (8799, LLM_MOCK) and `client-dev-room` (5181); test Chrome:
`chrome.exe --user-data-dir=.scratch/mlc/chrome-profile --remote-debugging-port=9333 --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --disable-renderer-backgrounding --disable-background-timer-throttling --no-first-run --window-position=1920,0 --window-size=1920,1080 "http://localhost:5181/?gpu=skip&room=video"`,
then `node shoot.mjs load` from `.scratch/video/`. Close any Browser-pane tab on 5181/8799 (it joins the room).

**Shots (order, seconds, state).** Peeked OK unless noted. Cast: Kai (player, curly hair), Mochi (pet), Rin (second
player), Elder, Mo, Ama, Pip. Day 10 = Thu (party), 11 = Fri.
| # | shot | s | what | state |
|---|---|---|---|---|
| 1 | title | 12.5 | aerial pan, MINDWORLD title, "built Oct 27-Nov 4 / already existed" card | OK |
| 2 | join | 10.5 | Kai leaves home, "RIN JOINED THE VILLAGE", confetti, greetings | OK |
| 3 | life | 12 | Ama stall, Pip chops + Elder herbs, Mo fishes (3 cuts with captions) | OK |
| 4 | inspect | 9 | inspector on Mo: tuned Llama, runs on Kai's computer, plan, goal, why | Kai's spot moved, re-peek |
| 5 | invite | 15.5 | Kai invites Pip, Pip thinks, says yes, love, inspector PROMISED, bunting | OK |
| 6 | leave | 10 | "THAT EVENING 17:00", Pip: "Time to go. I promised Kai!", walks to the floor | OK |
| 7 | wait | 7 | time-lapse 18:00-21:40, dancers leave, Pip waits, confused | OK |
| 8 | forgot | 4.5 | Kai fishing with Rin at dusk: "third fish tonight!" ("Kai forgot.") | OK |
| 9 | night | 5 | 22:10, Pip alone: "...Kai never came.", stress, fireflies | OK |
| 10 | stoodup | 8.6 | "NEXT MORNING", "You stood me up, Kai..." | OK |
| 11 | refuse | 9.2 | Pip tells Ama; Ama to Kai: "No deals for you today." | OK |
| 12 | sorry | 12 | apology, love; cut to Ama: made up, inspector THINKS (Pip said) | hold fix + cam -1.0, re-peek |
| 13 | ask | 5.2 | Mo: "Wanna duel? Ripple has been practicing." | OK |
| 14 | duel1 | 6 | battle screen, Mochi wins (ends ~4.5 s: trim to 4.6) | OK |
| 15 | duel2 | 10.5 | rematch, Mo's plan line, counter + crit, loss, Mo's quip | OK |
| 16 | coach | 10 | coach review card, typed lesson, thinking, memo updated, proof card | re-peek (new memo) |
| 17 | gazette | 4.4 | town board via game `drawMenu` + `paperRows` | not peeked |
| 18 | campfire | 6.4 | night fire, Elder's story, Pip's question, love | not peeked |
| 19 | postcard | 4.2 | 960x540, real Muse Image card rises over the fire | not peeked |
| 20 | dance | 5 | everyone dances at golden hour, confetti | not peeked |
| 21 | handover | 12.4 | split screen Kai's tab / Rin's tab, Mo answers, Kai closes tab, minds move | not peeked |
| 22 | close | 8 | dusk wide, title, mindworld.uryto.dev, models line, fade out | not peeked |
Sum 186.5 s: trim about 7 s in the edit (title 11.5, life 11, invite 14.5, sorry 11, coach 9, close 7, duel1 4.6).

**Narration** (`.scratch/video/narration.json`, 14 lines, 113.5 s at speed 1.0). Re-voice at speed 1.05 and
shorten n03 (drop "right in the tab") before the edit. Planned starts (seconds into each shot): n01 title+0.5, n02
join+0.3, n03 life+0.2, n04 inspect+0.8, n05 invite+9.0, n06 leave+2.0, n07 forgot+2.4, n08 refuse+0.2, n09
sorry+3.5, n10 duel2+0.3, n11 coach+0.4, n12 gazette+0.2 (runs over campfire and postcard), n13 handover+0.4,
n14 close+0.6.

**Cut v1 done (2026-11-05 00:40 VN):** `.scratch/video/mindworld-demo.mp4` (179.3 s, 1080p30, -14.2 LUFS, -1.4
dBTP, skill `check.py --platform youtube` 0 failed) + `mindworld-demo-preview.mp4` (27 MB, phone) + `mindworld.srt`
(narration subtitles for YouTube's caption upload; not burned in, because in-game cards sit at the bottom).
Pipeline, all in `.scratch/video/`: `render-all.sh` (clips) -> `edit.json` (order, tail trims, mood, narration starts)
-> `python -I mix.py` (original seeded chiptune per mood section, cuts land on shot changes; blips from the shots'
say/think/emote cues; Kokoro narration; music ducked 6 dB under speech) -> skill `loudness.py -I -14 --tp -1.5`
-> `python final.py` (skill cut.py `--accurate`, join, audio `--replace mix-14.wav`, check). Lossless cuts overshoot 2
frames per clip; always `--accurate`. Skill scripts run without `-I` (they import `_common`).
Postcard (user, 2026-11-05: "the image doesn't relate to the game"): `assets/card-fire.png` is now Muse Image 1.0
painted from two campfire frames of the game (`cardref/ref-wide.png`, `ref-close.png`) via `muse-card.py` (Responses
API `input_image`, cap 4 calls, 1 used); old card in `cardref/card-fire-old.png`. The game's own `/api/postcard` still
sends text only: same idea for the game = a later user decision.
**Not verified:** nobody has listened to the mix (no ear here; faster-whisper not installed). **[USER]** watch and
listen; confirm the opening line; upload the full-quality mp4.

## Setup
- Record https://mindworld.uryto.dev at 1080p, 1x.
- Two windows side by side: **A** = the user's normal profile with the tuned 1B loaded (B key or the setup screen; let
  it finish the download before recording). **B** = a second machine or an incognito window with no model (press B
  to unload if it loaded). Note A's and B's generated names; say A's name where the script says "Kai".
- Record in daytime: the game clock is shared (a day is 12 real minutes, night 22:00-06:00 is 4 minutes; villagers
  refuse duels at night). Campfire stories happen only in the evening.
- Takes that wait: a rival's new plan takes 13-15 s (cut the wait); a postcard takes a few seconds to paint; a Gazette
  paper comes once per game day (reload for a new one).

## Script (time / shot / voice)
**0:00-0:10. Opening line (required by the rules).** The village from above: tree clumps, the statue on the square.
> "Everything here was built this week, October 27 to November 4. What pre-existed: open-source libraries, a licensed
> pixel-art pack, and Meta's models." **[USER] confirm.**

**0:10-0:35. A village anyone joins from a link.** Window A walks out of their house; B joins from the same link and
appears next to A. Press I on Mo: `MIND` shows the tuned Llama, `RUNS ON` names A's machine.
> "Mindworld is a free browser village. The villagers think with a Llama 3.2 1B we fine-tuned from Muse Spark, running
> right in the player's tab. And the room shares it: the fastest machines think for everyone."

**0:35-1:10. The promise (the star shot).** A tells Pip: "my birthday party is this evening at the dance floor, come?".
Pip accepts; the inspector shows `PROMISED`. Cut (time card): Pip turns down the wood shift, "Time to go, I promised
Kai!", walks to the dance floor, and Kai isn't there.
> "Pip decided to come, put it in a calendar and skipped work for it. Nobody scripted this. And I didn't show up."

**1:10-1:30. Consequences.** Kai meets Pip: "you stood me up". "why are you mad?" gives the real reason. At Ama's stall:
refused, because Pip told Ama. "sorry", and the stall opens.
> "The game reasons from real state, what they own, promised and heard, and the model only picks among the valid
> options and speaks. So a villager can't promise what the world forbids."

**1:30-2:00. A rival who adapts.** A duels Mo ("wanna duel?") and wins. Duel again: Mo has a new plan and beats the same
memo; Mo says why. The coach review proposes a lesson; "Teach it"; the Prove bars show the lift on unseen fights.
> "Mo asks Muse Spark for a plan, and our sim rehearses it against my pet before Mo uses it. Lose, and the coach finds
> the lesson, and the game proves it on fights it never saw."

**2:00-2:25. The village lives without you.** Quick cuts: the Village Gazette toast and board ("today Mo beat Kai..."),
two villagers talking, the evening campfire story, then the postcard it painted (C opens the album). B and A kick the
ball and dance (emote 3).
> "Muse Spark writes the village paper from the day's real events, villagers tell stories from their memories, and Muse
> Image paints a postcard of the moment."

**2:25-2:48. Hand-over.** B (no model) asks Mo something; the answer comes from A's machine ("talking..." on A). Close
window A. Within ~15 s Mo is hosted by B and still remembers Kai.
> "No GPU? Your question goes to whoever hosts that villager. When a host leaves, the minds move on, memories included,
> so the village stays alive to the last person."

**2:48-3:00. Close.** The village at dusk, the URL.
> "Free on any hardware: a player's machine, a capped cloud call, or rules. Next: home servers lending bigger models to
> the room. Mindworld, at mindworld.uryto.dev."

## Shot list and prep
| # | Time | Shot | Prep |
|---|------|------|------|
| 1 | 0:00-0:10 | Village from above | A daylight take; `cdp-map.mjs` style overview or zoom out |
| 2 | 0:10-0:35 | B joins next to A; inspector on Mo | A hosts Mo (check `Object.fromEntries(__px.world.npcs.hosts)`) |
| 3 | 0:35-1:10 | Invite, PROMISED, Pip leaves work, empty dance floor | Morning take + evening take |
| 4 | 1:10-1:30 | "stood me up", why, stall refused, sorry | Next game day, stall open (Ama works mornings) |
| 5 | 1:30-2:00 | Mo duel x2, loss explanation, review, Teach it, Prove | Daytime; cut the 13-15 s plan wait |
| 6 | 2:00-2:25 | Gazette, banter, campfire story, postcard, ball and dance | Evening for the fire; clear the album's card of the day first if testing |
| 7 | 2:25-2:48 | B asks Mo, close A, Mo moves to B | Both online; wait ~15 s |
| 8 | 2:48-3:00 | Dusk + URL | |

## Every Meta model use (for the voice-over, README and form; check against the code before recording)
- **Llama 3.2 1B Instruct, fine-tuned** (LoRA on Modal, distilled from Muse Spark Open; WebLLM in the tab): every
  villager's and pet's mind: plan, choose (grammar-constrained to the sim's options), lines, emotes, reflection.
  97.0% valid decisions on 300 held-out cases (`ai/npc.md`).
- **Muse Spark Open** (Baseten `meta-models/muse-spark-open-1026`): villager chat when no nearby player has a model;
  villagers talking to each other and campfire stories (`/api/banter`); a watching villager's line after a fight
  (`/api/cheer`); rival plans (`/api/rival`); Teach (lesson to rule memo); the teacher for all training data. On Modal: the
  optional cloud move chooser (`?cloudmoves`).
- **Muse Spark 1.3** (Meta Model API): the Village Gazette (`/api/gazette`, one paper per room and game day); the coach
  reflect ("learn from my fights").
- **Muse Image 1.0** (Meta Model API): postcards (`/api/postcard`, $0.01 each, $2/day cap, album on C).
- **Muse Voice Transcribe** (Meta Model API): teaching by voice (`/api/transcribe`).
- Numbers: Prove lift +29.0 pts held-out on the combat bench (`ai/pet.md`); tuned 1B 97.0% valid.

## Before recording (checklist)
- [ ] **[USER]** Confirm the opening line and the motivation lines.
- [ ] Every beat run once on live the same day (Claude, `scope-check`), so the takes are known to work.
- [ ] A has the model loaded and hosts the villagers in the shot; B has none.
- [x] Re-check the numbers above against `ai/npc.md`, `ai/pet.md` and the inspector's labels on camera (2026-11-04,
  live): 97.0% / 300 cases (`ai/npc.md`, `ai/models.md`, README) and +29.0 pts (`ai/pet.md`, README) match. Labels on
  screen, for the voice-over: inspector "Last line: thought on your computer (Llama 3.2 1B, tuned)" and "Runs on: this
  computer, for all"; Teach "Memo updated by the Muse Spark (open weights)" (3-5 s); banter, cheer and stories say
  "Muse Spark Open"; the Gazette says Muse Spark 1.3. Proof shot: `.scratch/chk7/inspector.png` (not kept).
- [ ] After Access goes (P8): record or re-check the join from outside so the URL in the close works for a stranger.
