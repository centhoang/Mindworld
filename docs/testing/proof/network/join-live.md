# Join checks on live (plan P3)

One block per loop run. The bots run with `node scripts/join-check.mjs` (live `check` room: its own Durable Object, so
test bots never take plots or host villagers in the real village). Real tabs use the built-in browser pane; `?p=N` is
another save (another player), `?room=check` joins the bots' room.

## Run 1 (2026-11-04 00:13 VN, worker after the room names, client `main-B3I3qJXN`): 18/20
- 20 at once: all in, welcome p50 888 ms, max 1395 ms, no retries; everyone sees everyone, nobody twice, no stuck socket.
- Plots: 12 plots, 9 guests. A plain refresh got its plot back.
- **FAIL, bug 49:** a refresh while a newcomer joined in those seconds came back a guest; the newcomer had the plot (had 11,
  got null; newcomer 11).
- **FAIL, bug 50:** a late joiner next to a farm did not get it (only the owner's tab resending would have shown it).
- Late joiner: same last kick as everyone, the open talk, all four villager hosts. Kick burst (10 players x 3 s): one last
  kick for all 23, none out of order, nobody thrown out. Host leaves: another player hosts at once.
- **100 held at once** (in 3 s, no handshake failures; the old 89-of-100 was this machine's link with no retry). Traffic while
  100 walk: p50 979 B/s per player, max 6625 B/s. The 101st is told `full`; the next room (`check-2`) lets them in.
- After everyone leaves: the room is empty.

## Run 2 (00:16 VN, worker 71e2422f: bugs 49 and 50 fixed): CLEAN 20/20
- Welcome p50 404 ms, max 490 ms. Refresh with a newcomer meanwhile: had 11, got 11; newcomer a guest. Late joiner gets the
  farm in the welcome. 100 held in 3 s; p50 953 B/s per player while walking.

## Run 3 (00:53 VN, worker 82897677, client `main-26ntqsHn`: after bugs 51, 52 and the swim fix): CLEAN 20/20
- First try showed 4 FAILs: the test Chrome's tab was still in `check` (one already in, it hosted the villagers, 99 + it =
  100). With it closed: 19/20, one plot short: the last run's final bot had left 15 s before and its plot was held for a
  refresh (bug 49's rule, correct). The check now counts such held plots. Then clean; 100 held in 3 s, p50 859 B/s.

## Real tabs (worker 90231c37, client `main-YyXIB9a_`)
- **Guest yard told in one line** (`guest-yard-live.jpg`): 20 bots held the `check` room's plots, a new save (`?p=6`) joined:
  "All 12 plots are taken, so you live in the Guest yard." Its home label is "Guest yard". The save before it (`?p=5`)
  had joined first and got a plot; its reload took the same plot back from its ghost.
- Join time, new save: page script ready at 2.1 s, villager id from the room (online) by ~3 s, the welcome toast up at 2 s
  after a reload. `load` fires at 8 s while art is still coming; the village draws before that.
- **Village full: you are sent on** (`spill-village-2-live.jpg`): 99 bots + one tab filled `check`; a new save landed in
  `check-2`: "The village was full, so you are in village 2.", online, with its own plot there.
- **A background host hands its villagers on** (worker 90231c37): tab A hosted all four; with A's `document.hidden`
  simulated (the pane never sets it) and `visibilitychange` fired, all four moved to tab B within 1.5 s. Tab B closed:
  all four came back to A at once.
- **Joining mid-duel** (bug 51 found here): A challenged B by `live.challenge`, B pressed Enter; both in battle with the
  same fight. C joined: no errors in A or B, both still fighting, C online. But the room's join balance gave C's join
  villagers to the fighters, whose village does not step in battle: they stood still for everyone. After the fix
  (worker abdd7a91, client `main-dtJcyyv0`): as the duel began, all four villagers moved to C and kept walking (Mo
  3.9,1.7 -> 13.3,-0.6 in 6 s).
- **Three people dancing** (`three-dancing-live.jpg`): three tabs on the square pressed 3 (Dance); each sees the other two
  with the dance pose, `dancers()` = 3 in every tab, and the floor is lit.
- **Phone-size window** (375 x 812, mobile user agent; `phone-size-before.jpg` -> bug 52 -> `phone-size-live.jpg`):
  joins and is online, no sideways scroll. Before: the Goals card and the bottom line were cut at the right edge, the map
  off-screen (125 art columns). After (client `main-26ntqsHn`): 375 columns, Goals card, clock and map in view. No touch
  controls: a phone can join and watch but not walk (not in the plan; noted in HANDOFF).
- **Slow connection, first visit, no cache** (test Chrome, DevTools network emulation, `.scratch/chk/slow-net.mjs`):
  Fast 3G (1.6 Mbps, 150 ms): first frame 2.8 s, online 3.3 s. Slow 3G (400 kbps, 400 ms): first frame 9.9 s, online
  12.0 s. The rest of the art (6.6 MB in all) streams in after; the village is playable meanwhile.
- **No GPU model:** every tab above ran without a local model (tps 0): villagers ran on rules and cloud lines, hosting
  worked the same.

## 2026-11-04 ~10:40 VN: "a late joiner sees who is talking" (worker c25d5953, no worker change)
- Failed twice in a row this morning (`.scratch/p4/join-check-55.txt`, `-55b.txt`). Cause was the script: the talkers were
  fixed burst slots 2 and 3, but the refresh steps quit whichever burst bots got plots first, and plots go by arrival
  order, so a talker could be a closed socket (its `talk` never sent, or its id gone). The room's `talk()` was fine.
- Fix (`scripts/join-check.mjs`): the talkers are any two bots still in the room; the check's note now says what the
  talker got (`talking` / `talkNo`) and how many talks the late joiner's welcome holds.
- Runs after: `--big 0` 18/18 (`-56.txt`); full 19/20 once (one burst socket retried past the 12 s window, 100-player
  fill 13 s: network); full again **20/20** (`-56c.txt`, talker got `talking`, welcome talks 1, 100 in 4 s).

## 2026-11-04 ~16:30 VN: the flaky join check (worker 0b4d6bf9, client `main-czFxq799`)
- Before: four runs straight after the P5d/P5e deploys went 16, 20, 17, 19 of 20, each failing a different socket check
  (`.scratch/p5/join-check-p5{d,d-2,e,e-2}.txt`). P5 changed no room code.
- Found: each bot try now logs when it started, how long it took to open and how it closed. From this home link a
  socket takes 1-2.5 s just to open under a 20-socket burst (before any room code runs); the room's welcome comes
  0.3-0.9 s after that. Three runs with no deploy in between: 20, 20, 19 (a newcomer with no welcome in 8 s: the link).
  Every bad run of the day had come right after a deploy, when the Durable Objects restart.
- Fixed in the script: a try with no welcome in 6 s is dropped and retried; single joins wait 15 s; a retry timer no
  longer brings back a bot that already left (the "2 left behind" of `p5d`); the kick burst waits up to 4 s for
  everyone to agree and prints how long it took. Rule in `docs/ops/tooling.md`: run it a minute after `/` serves the new build.
- Fixed in the game (`client/src/world/live.ts`, `WELCOME_WAIT_MS`): a connect with no welcome in 10 s is let go and
  retried with the usual back-off, so a stalled handshake no longer leaves a player on "connecting" until the browser
  gives up; each socket has its own keepalive (unit tests in `live.test.ts`).
- After, no deploy: 20/20 x3 (`.scratch/p6/join-check-r{4,5,6}.txt`). After the deploy, a minute after `/` served
  `main-czFxq799`: **20/20 x3 in a row** (`join-check-deploy-{1,2,3}.txt`): burst welcome max 1.2 / 1.1 / 1.6 s, no
  retries; kick burst settled in 184 / 177 / 182 ms; 100 held in 8 / 3 / 9 s.
