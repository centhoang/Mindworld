# Hatch, follow, mood, door (deployed build, 2026-11-02)

Run in the test Chrome on pets.uryto.dev with fresh saves. Sheet: `hatch-mood-door.jpg` (egg, cracks, sparks, pet; play, bored, glad; door closing, inside).
- Hatch: 4 s egg in the open in front of you, rocks, cracks, sparks, then the pet. Pets differ: `5d.md`, 12 seeds gave 12 pets.
- Follow: gap 1.40 after walking. Pushing against a wall hops over within 1.2 s: unit test in `pet-mood.test.ts`, not forced on live.
- Mood: standing still it plays (wiggle), then sits; it sleeps at night (unit test only); it dances with a note after a win (cheer called directly, not a real fight).
- Door: the view closes in a circle and opens, values 0 to 0.97 and back. In and back out both work, and you land at your door.
- Window sizes: 800x600, 1024x700, 1366x768, 1100x901, 1537x865, real resizes at 125% Windows scaling: canvas = device pixels at all five. Other scalings not tried.
