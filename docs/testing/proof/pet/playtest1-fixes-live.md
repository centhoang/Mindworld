# Play-test #1 fixes on live (bugs 53-60), 2026-11-04 ~10:45 VN

Live worker c25d5953, build `main-Aj3mXOIh`, test Chrome at 1020x561 (low-res 510x281 at scale 2... the game picks the
scale; the scene is drawn at half that and doubled). Commits dcfbe7c (53, 54, 56-60) and the bug 55 commit after it.

| Bug | What changed | Proof |
|---|---|---|
| 53 | The campfire pose `warm` plays idle and `doing`, never the fishing strips (casting, waiting, reeling, caught). | `humans.test.ts` "plays the fishing strips only while fishing"; [campfire shot](../visual/campfire-53-54-live.png): Mo and the Elder stand by the fire, no rod. |
| 54 | One pack `spr_deco_fire_02` flame footed at the ring's pit, (10, 6) from its top-left, as the pack's Room1 lays it (was three `fire_01` candles at its top left). | [campfire shot](../visual/campfire-53-54-live.png), 3x. |
| 55 | Codex redrew the room (`gen/home-small-open.png`, take 3): back wall rows 4-15 with one window, bed, shelf, the table whole at the top right; no stool, no picture; `game/house.ts` floor plan from Codex's measured plan, doorway unchanged. | [room shot](../visual/house-55-inside-live.png). |
| 56 | Codex redrew `stripes` (three forehead marks; bands across the back), `nubs` (two clear nubs above the head), `floppy` (ears hanging along the head, seen from behind too): 90 files, 5 builds x 16/32/48 x front/back. Other 495 pet files byte-identical. | `.scratch/pet-marks-preview.png` (old vs new), `.scratch/pet-marks-result.md`; `pet-parts.test.ts`. |
| 57 | While a shout is open, the command box lists `SHOUTS: n`, 1 GO! 2 GUARD! 3 RUN! 4 BE NICE! 5 FRIENDS!, the called one lit; a tap on one calls it (phones). | [battle shot](battle-57-59-live.png): "2 GUARD!" lit after key 2; `battle.test.ts` tap test. |
| 58 | Both HP panels in a bar along the top: mine left (my side), the foe's right; each at least 8 px clear of both pets and the text box. | [battle shot](battle-57-59-live.png); `battle.test.ts` layout at 360x216, 384x216, 480x243, 400x270, 640x270. |
| 59 | The scene (Codex backdrop, ground, pads; trainers; both pets at native 32 px) is drawn on a half-size canvas and doubled: one pixel size, the trainer's. The text box portrait is the pet's head (16x16 of its 32 px art), doubled. Panels and text keep the game's UI size, as in the village. | [battle shot](battle-57-59-live.png). |
| 60 | "What are you up to?" with no activity: "Not much. Just taking it easy tonight." (the hour's words); "Right now? We sit by the campfire." when asked as a group at a shared activity. | `directions.test.ts`. Not yet asked on live. |

Not checked here: a green pet on the green meadow reads by its outline only (seen on live with a green Brute; fine).
