# Walk slide, deployed build (2026-11-02, version d99f011e)

Held D for 1.2 s on pets.uryto.dev, logged the world plane's blit offset each frame (85 frames in 2.1 s, plane px, 1 cell = 8).

`0 x18, -1 -2 -3 -4 -5 -5 -6 -6 -6 -7 -7 -7 | -1 -2 -3 -4 -4 -5 -6 -6 -6 -7 -7 -7 | -1 -2 -3 -4 -6 -6 -7 -2 ...`

Each `|` is a whole-cell rollover, not a visible jump. Steps are 1-2 px, with a rare 3-4 px on a slow frame. After release it settled at `0,0`, so the planes line up on one grid at rest.
