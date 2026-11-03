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
- [!] [proof](../proof/network/5b-numbers.md) 100 bots asked, 89 held by one machine: smooth, but 100 itself is not proven.
- [x] [proof](../proof/network/5b-numbers.md) A dropped connection reconnects with no duplicates.

Many players join live without issue (user, 2026-11-03; plan P3):
- [ ] Open the link and you are in the village, online, within about 10 s, with no setup.
- [ ] 20 players joining in the same second all get in: none lost, none twice, none stuck "connecting".
- [ ] When the village is full, the next player still plays with others (a second village), not alone.
- [ ] The first 12 players get a plot; later ones join the Guest yard and are told so. A refresh gives you your plot back.
- [ ] Someone who joins late sees the ball, a dance or a game in progress, the villagers and the farms as they are now.
- [ ] Joining while others fight, dance, sit inside or host the villagers breaks nothing for anyone.
- [ ] Players with no GPU, a phone-size window or a slow connection can join and play.
- [ ] After the game goes public: a phone on mobile data and a second machine join at the same time.
