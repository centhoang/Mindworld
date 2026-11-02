# Bug 25: no backward step while holding a direction (deployed build)

Version b4d21909, main-DSpFCbvf, on pets.uryto.dev with the room connected, 2026-11-03. Test Chrome, every frame, about 1 s per hold. Probe: `drawImage` hook on the own-player plane plus the world plane, tree cover filtered out.

| Hold | Before: frames back, worst px | After: frames | After: back on screen | After: back on ground |
|---|---|---|---|---|
| walk right | 17, 25 | 48 | 0 | 0 |
| walk left | 16, 7 | 44 | 0 | 0 |
| walk down | 13, 2 | 28 | 0 | 0 |
| walk up | 13, 7 | 47 | 0 | 0 |
| run right | 14, 8 | 27 | 0 | 0 |
| run left | 15, 25 | 40 | 0 | 0 |
| run down | 15, n/a | 38 | 0 | 0 |
| run up | 11, 22 | 48 | 0 | 0 |

The before column counts screen steps only; its "n/a" is a frame where cover hid the player from the old probe. Every after-step along travel, in px:

- walk right: `0 0 0 0 0 0 1 0 0 1 0 0 1 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0`
- walk left: `0 1 0 0 1 0 0 0 0 1 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0`
- walk down: `0 0 0 0 0 1 0 0 1 0 0 1 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0`
- walk up: `0 1 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0`
- run right: `0 2 0 3 0 0 0 1 0 0 0 1 0 0 0 0 0 0 1 0 0 0 0 0 0`
- run left: `0 2 0 0 1 0 1 0 0 2 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0`
- run down: `0 0 1 1 0 1 0 1 0 1 0 1 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0`
- run up: `2 0 0 0 1 0 1 0 1 1 0 0 0 1 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0`

Localhost alone showed the same before numbers (13-15 back frames, up to 8 px), so the room was never the cause.
