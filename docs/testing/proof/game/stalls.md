# Bug 26: half-second stalls (test Chrome, 2026-11-03)

Frame gaps over 120 ms in a rAF loop, no change to the page. Long tasks stayed at 0-1 throughout, so the game's own code was never busy.

| Run | Time | Gaps |
|---|---|---|
| Live, walking, earlier in the night (4 runs) | 40 s | 19 gaps, most about 500 ms, three about 3 s |
| Localhost, walking, same hour: old view 2 runs, new view 2 runs | 40 s | old 5, new 7: not the fix |
| Empty page, with and without keys | 22 s | 0 |
| Plain canvas page: same sizes, 24 Hz repaint, no game code | 30 s, 1700 frames | 0 |
| Live, standing, later | 15 s, 849 frames | 0 |
| Live, walking, keys from the page, later | 30 s | 1 of 472 ms, 2 of 125 ms |
| Live, walking, keys from the debugger, later | 30 s | 0 |

Verdict: load on this machine at that hour, not the game. CPU read 62% once during the bad runs. Same build, same walk, later: about 57 fps with one stall in a minute. The first cause is not pinned down further. The Browser pane was no use here: hidden, it runs no frames.
