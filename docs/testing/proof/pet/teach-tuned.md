# Teach through the tuned model (2026-11-02)

Deployed `/lab/pet`, test Chrome on the GTX 1050, tuned Llama 3.2 1B (`/mlc/n4/`). Model load 17 s, from cache. Shot: `teach-tuned.png`.

| Lesson | Time | Result |
|---|---|---|
| guard when it winds up a heavy hit | 30 s | Rule 1 GUARD, when the enemy is winding up a heavy hit. Proof +28.1 pts, 61% > 89% wins, 1000 new fights |
| use your strongest attack when the enemy is weak | 12 s | Memo unchanged. Proof +0.0, 89% > 89%. The lesson is not reflected in the rules |
| eat the moon and sing to the rocks | 17 s | Accepted: four junk "enemy is a pal" rules added. Failed, so `isFightLesson` now refuses it in code (prompts are frozen) |

Seen on live after the fix: refused in 1 s with no rule added, `teach-refused.png`.
