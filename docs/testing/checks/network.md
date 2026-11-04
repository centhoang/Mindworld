# Network checks

Lab: `/lab/net`. Second player: `?p=2`.

- [x] [proof](../proof/network/5b-numbers.md) Two players see each other move. Jumps need your eye: positions now arrive at 5 Hz.
- [x] [proof](../proof/network/5b-numbers.md) Walking away makes the other player vanish cleanly; coming back brings them back.
- [x] unit test only (`aoi.test.ts`) No flicker when you stand on a border.
- [x] [proof](../proof/network/5b-numbers.md) (farm; house not sent by the room) Farm and house changes show for anyone nearby, and for anyone who arrives later.
- [x] [proof](../proof/network/5b-numbers.md) Bubbles and emotes reach people nearby only.
- [x] [proof](../proof/network/5c5d-live.md) Villagers are in the same place for both players.
- [x] [proof](../proof/network/5c5d-live.md) If the villagers' host leaves, they carry on.
- [x] [proof](../proof/network/5b-numbers.md) Traffic per player stays flat as players are added far away.
- [x] [proof](../proof/network/join-live.md) 100 players held at once on live (the old 89 was this machine's link with no retry).
- [x] [proof](../proof/network/5b-numbers.md) A dropped connection reconnects with no duplicates.
- [x] unit test only (`live.test.ts`) A connect that stalls (no welcome in 10 s) is dropped and tried again by itself, so
  nobody is left on "connecting" by a slow link (2026-11-04).

Many players join live without issue (user, 2026-11-03; plan P3). Proof: [join-live.md](../proof/network/join-live.md);
the bot part is one command, `node scripts/join-check.mjs` (run it after every deploy):
- [x] Open the link and you are in the village, online, within about 10 s, with no setup (home link ~3 s; Fast 3G 3.3 s;
  Slow 3G 12 s).
- [x] 20 players joining in the same second all get in: none lost, none twice, none stuck "connecting" (100 held too).
- [x] When the village is full, the next player still plays with others (a second village), not alone.
- [x] The first 12 players get a plot; later ones join the Guest yard and are told so. A refresh gives you your plot back,
  even if someone new joins in those seconds.
- [x] Someone who joins late sees the ball, the villagers, who is talking and the farms as they are now. (A player's own
  dance shows from their next move; villagers' dances show at once.)
- [x] Joining while others fight, dance or host the villagers breaks nothing for anyone. (Indoors: the same away rule as
  fighting, not run live.)
- [x] A player who fights, goes indoors or puts the tab in the background hands the villagers to a free player at once.
- [x] Players with no GPU, a phone-size window or a slow connection can join and play. (A phone has no touch controls yet:
  it can join and watch.) Touch controls since P4 (`pixel/touch.ts`: stick, E / X / T), proven in the dev pane at 375x812;
  not yet on a real phone.
- [x] [proof](../proof/network/llm-lockdown-live.md) A player whose connection dies without a goodbye is gone from
  everyone's list within about 90 s (the room's reaper), so the room never fills with ghosts (2026-11-04).
- [x] [proof](../proof/network/llm-lockdown-live.md) The cloud model behind the game answers only the game's own four
  kinds of request; any other prompt is refused (2026-11-04).
- [x] [proof](../proof/network/llm-lockdown-live.md) After the move to mindworld.uryto.dev: the new address is blocked from outside (Forbidden on mobile data) until P8, and the game
  from home.
- [ ] After the game goes public: a phone on mobile data and a second machine join at the same time.
- [x] [proof](../proof/network/bug64-teach-live.md) While a host is on the Teach screen, the villagers it hosts keep walking for everyone, and the day does not jump when it closes (bug 64).
