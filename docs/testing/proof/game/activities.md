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
| dance | jump | Kept: closest strip, no real dance. The birthday party rests on it |
| soccer | run | Kept: villagers run the pitch after a moving ball. No kick strip |
| sleep | none | At home: own door, unseen |
| cook, the villagers' eating | none needed | At home: own door, unseen |
| **picnic** | no sit strip | **Dropped**, with the blanket and basket |
| **feed** | no one could ever do it | **Dropped** |

Not proven: `clean` and `dance` were forced by the driver for a shot, not seen in a natural run on this build.
Shots: `sunny-activities.jpg`, `../visual/sunny-village.jpg`, `../visual/sunny-home.jpg`.
