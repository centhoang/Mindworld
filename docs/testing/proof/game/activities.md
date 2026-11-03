# Human activities on Sunnyside (2026-11-03)

Rule from the user: an activity that needs a human animation the pack does not have is dropped. Pack strips: idle, walk, run, jump, doing, waiting, axe, dig, watering, casting, reeling, caught, attack, carry, hammering, mining, roll, swimming, hurt, death.

| Activity | Strip | State |
|---|---|---|
| fish | casting, waiting, reeling, caught | Kept |
| chop | axe | Kept |
| tend | watering | Kept |
| farm | dig, watering | Kept |
| sell | idle, doing | Kept |
| clean | doing (its dust puff) | Kept, player only: villagers have no messes |
| wander | walk | Kept |
| dance | jump, roll, doing (a routine) | Kept. P2: on the dance floor, open (one may start, others join), evening party pull |
| soccer | run | P2: the real shared ball (`life/ball.ts`); villagers chase it and shoot; open kickabout |
| campfire (P2) | idle, waiting | Evening, open group on the green; the pack's campfire burns |
| haul (P2) | carry (walking), doing | Right after chop, farm or mine: to the stall's side |
| repair (P2) | hamering (pack spelling) | Beside the stall, the board or the well |
| mine (P2) | mining | The quarry rocks north-east of the pond (map "r") |
| feed (P2) | doing | Back: the farm animals' yard on the Elder's lawn (chicken, sheep, pig, cow strips) |
| swim (P2) | swimming | The pond's far shore spots; drawn a tile out in the water |
| sleep | none | At home: own door, unseen |
| cook, the villagers' eating | none needed | At home: own door, unseen |
| **picnic** | no sit strip | **Dropped**, with the blanket and basket |
| **feed (old)** | no one could ever do it | Dropped then; back in P2 with the animals' yard |

Not proven: `clean` and `dance` were forced by the driver for a shot, not seen in a natural run on this build.
Shots: `sunny-activities.jpg`, `../visual/sunny-village.jpg`, `../visual/sunny-home.jpg`.

## P2 (2026-11-04 00:30 VN, live `main-CrFuSOoI`, worker f42a02af)
- **Ball on live, unforced:** at 08:18 game time Pip started a kickabout alone, chased the real ball and scored ("PIP GOAL!"
  bubble). Two live tabs logged the same kick numbers (1793724794321, ...796329, ...799474, ...) and the same ball path on the
  same kick (x 21.99 both; z read 0.1 s apart while it rolled).
- **Local room (mock worker, two tabs):** a kick from tab 1 rested at (25.300074445162217, 2.5) in both tabs, same number.
  A villager hosted in tab 1 dribbled and scored twice in 15 s (7 kicks, all through the room).
- **Local shots (pane visible):** lit dance floor with Elder and Mo dancing; campfire burning with Elder and Mo facing it;
  yard animals with the Elder feeding; Mo repairing at the board; Mo and Pip mining at the quarry rocks.
- **Headless watch** (`.scratch/p2-watch.mts`, 4 seeds x 2 game days, no model, personas and jobs; chat timers run at
  once): sleep 64, campfire 61, haul 38, cook 36, sell 32, dance 30, fish 18, farm 18, feed 18, mine 16, chop 16, swim 13,
  repair 9, tend 8, soccer 7. Every new activity starts unforced.
- **Not proven yet:** the 12-min live watch with each activity seen unforced; swim and haul's carry strip not seen on screen.
