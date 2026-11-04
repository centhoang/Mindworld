# Bug 64 on live: the village steps behind the Teach screen (2026-11-04)

Worker 48d95812, client `main-DYBhX2Bg`. Player 2 (no-GPU bench Chrome), alone in room `check`, hosting all four
villagers. Teach opened (T), held open 20 s, then closed:

| | sim clock | elder | mo | ama | pip |
|---|---|---|---|---|---|
| Teach opened | 747084.3 | sleep @0.0,-14.3 | sleep @9.9,-10.7 | sleep @-11.1,-3.9 | wander @-0.5,2.7 |
| 20 s later, still open | 747104.4 | sleep @0.0,-14.3 (in bed) | @11.6,-12.4 | @-12.9,-8.3 | @-0.4,2.0 |

The clock moved 20.1 s and three villagers kept walking (to bed, at 23:28). Before the fix the same tab's clock stood
still for minutes behind an open Teach screen, and on closing it all four villagers slept on through noon.
