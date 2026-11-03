# Bug 44: only Sunnyside people, live day watch

Live build `main-CaH4vzcS.js`, TEMP Chrome, 03:56:20 to 04:46:21 UTC (51 samples, 50 real minutes, about one game day at 30 game minutes a minute). Every `drawImage` was hooked: any old 16 x 24 person frame, `elder-npc` or `player-walk` counted as old. The player was moved beside a different villager each minute so their activities were on screen.

- Old person frames drawn: **0**.
- Sunnyside strips drawn: idle 1062978, waiting 35973, reeling 26316, caught 10482, casting 18126, walk 48606, doing 30465, watering 41163, dig 10224.
- Villager states seen: ama:do/cook, ama:do/sell, ama:do/sleep, ama:do/wander, ama:idle, elder:do/cook, elder:do/farm, elder:do/fish, elder:do/sleep, elder:do/tend, elder:do/wander, elder:idle, elder:walk/sleep, elder:walk/tend, elder:walk/wander, mo:do/cook, mo:do/fish, mo:do/sleep, mo:do/wander, mo:idle, mo:wait/dance, mo:walk/dance, mo:walk/farm, mo:walk/fish, mo:walk/wander, pip:do/cook, pip:do/farm, pip:do/sleep, pip:do/wander, pip:idle, pip:wait/dance, pip:wait/soccer, pip:walk/dance, pip:walk/soccer, pip:walk/wander.
- Shot mid-watch: [old-sprite-44-live.jpg](old-sprite-44-live.jpg).

Unit test `humans.test.ts`: every pose (null and all 15), walking and running, in every look, resolves to a Sunnyside strip on disk; nothing else is drawn while strips load; a failed strip is fetched again.
