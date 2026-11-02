# Walk slide and the grid at rest (deployed build, 2026-11-03)

Replaces the 2026-11-02 run: the view now follows your real position, not whole cells, so walking has no rollover bursts.
- Moving: every step along travel is 0-3 px forward, on all sides: `../game/walk-steady.md`.
- At rest: after walking right and after walking down, all three planes were drawn at `[0,0]`, so they sit on one grid.
- Lab scenes 1-5, night, and the village on live: `5c-live.jpg`. No console errors. The lab page no longer shows scrollbars.
