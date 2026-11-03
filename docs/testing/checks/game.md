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
