# Network checks

Lab: `/lab/net`. Second player: `?p=2`.

- [x] [proof](../proof/network/5b-numbers.md) Two players see each other move. Jumps need your eye: positions now arrive at 5 Hz.
- [x] [proof](../proof/network/5b-numbers.md) Walking away makes the other player vanish cleanly; coming back brings them back.
- [x] unit test only (`aoi.test.ts`) No flicker when you stand on a border.
- [x] [proof](../proof/network/5b-numbers.md) (farm; house not sent by the room) Farm and house changes show for anyone nearby, and for anyone who arrives later.
- [x] [proof](../proof/network/5b-numbers.md) Bubbles and emotes reach people nearby only.
- [ ] (not run live: unit test only) Villagers are in the same place for both players.
- [ ] (not run live with AOI) If the villagers' host leaves, they carry on.
- [x] [proof](../proof/network/5b-numbers.md) Traffic per player stays flat as players are added far away.
- [!] [proof](../proof/network/5b-numbers.md) 100 bots asked, 89 held by one machine: smooth, but 100 itself is not proven.
- [x] [proof](../proof/network/5b-numbers.md) A dropped connection reconnects with no duplicates.
