# Full game checks

Run on `/` only when every other list is clear. Two or more players, deployed build.

- [ ] A stranger plays with no setup and knows what to do in a minute. (needs a person)
- [x] The birthday promise works from start to end. (proof: ../proof/game/birthday.md; kept and broken, real clock, walking shortened)
- [x] Farm, fish, sell and buy make one loop. (proof: ../proof/game/sunny-live.md; grow wait cut by the driver)
- [ ] Teach, then Prove, then a duel with a friend. (duel proven: ../proof/game/sunny-live.md. Teach waits for step 7: no coach under `LOCAL_ONLY`)
- [!] Every human activity works for players and villagers. Picnic dropped; clean is player-only. On Sunnyside live: sell, fish, tend, farm, chop, cook, sleep and wander seen unforced; P2 soccer seen unforced with the real ball. Dance, campfire, haul, repair, mine, feed and swim start unforced in the headless watch; the 12-min live watch is still to do. (../proof/game/sunny-live.md, list and P2 proof: ../proof/game/activities.md)
- [ ] There is one ball for everybody: walk into it and it rolls the way you walk; a villager playing soccer chases it and shoots; a goal gets a "Goal!"; every player sees the same ball. (local two tabs and live two tabs: ../proof/game/activities.md P2; a real second person still to try)
- [ ] Someone can start a kickabout or a dance alone, and others come and join it. Dancing near the dance floor (the Dance emote) draws villagers in.
- [ ] The dance floor lights up while anyone dances; the campfire burns in the evening; the farm animals amble in their yard.
- [x] No fishing without water, no walking through solid things. (proof: ../proof/game/sunny-live.md, ../proof/game/2-players.md)
- [x] Holding one direction, walking or running, your character moves smoothly and never jumps back, also in the first hold after a teleport. (proof: ../proof/game/walk-steady.md, ../proof/game/sunny-live.md)
- [x] Two players in the village see the same day. (proof: ../proof/game/sunny-live.md)
- [ ] Runs with no GPU: rules and cached lines, and it says so. (waits for step 7: `LOCAL_ONLY` shows no scripted lines; `?gpu=skip` works in dev only, so live needs a machine with no GPU)
- [x] Every morning the town board has a Gazette: three headlines about what really happened in the village lately, the same for everyone in the room, and it says who wrote it (Muse Spark 1.3, or the villagers' notes when the cloud is off). (proof: ../proof/game/p5-live.md)
- [x] A villager who sees your fight start calls out once when it ends, in their own voice, and remembers it. (proof: ../proof/game/p5-live.md)
- [x] Looking inside a mind (I) says what answered its last line, in plain words. (proof: ../proof/game/p5-live.md)
- [x] Two villagers who meet while you are near talk about real things from their day (what they did, sold, saw you do), and remember it. (proof: ../proof/game/p5-live.md)
- [x] Win a fight, or sit through a campfire story, and a painted postcard of your own pet and who was there comes to your album (C), at most one of each a game day; with the cloud off nothing breaks. (proof: ../proof/game/p5-live.md)
- [x] In the evening, sit by the campfire with villagers and one tells a story about something that really happened; the others react, and they remember telling it. With the cloud off, a simpler story still comes from their notes. (proof: ../proof/game/p5-live.md)
