# Village rivals on live (2026-11-03, builds main-BUSUDh6c and main-mYTbEBmg)

Driven from the Browser pane on pets.uryto.dev (pane hidden, so `battleView.update` by hand). The player walked up to a
villager, opened the chat (E), typed the ask, and picked Fight. Memo: guard heavy, befriend below 40%, emote at a guard.

**At night** (game hour 23): "Mo, wanna duel?" -> Mo: "It's late, Brave Mochi. Ripple is asleep. Ask me tomorrow."

**Mo, morning** (the cloud plan was cached; the rehearsal still chose a bundled one, which led to `CLOUD_SLACK`):
```
Mo sends out Ripple!
Mo studies how your pet fights...
Mo: "Ripple, guard against its guard!"
Ripple hides behind its guard. (1-5: shout a move, 2 left)
Mochi: does a happy little dance.
Ripple winds up a HEAVY hit! ...
Mochi blocks it!
Mochi counters!
...
A critical hit!
Mochi blocks it! Star Pounce is charged!
Mochi: tries to run away!
Mochi ran away safely.
Ripple strikes right after it guards, with a HEAVY hit.
Your lessons are right: use your two shouts (keys 1-5) at the turns that matter.
```
Mo after: "Ripple read your pet well. Train it and come back, Brave Mochi." (The pet ran at low HP; that build's tip
ignored it. Now the tip starts "Your pet ran when it got hurt.")

**Ama, noon** ("Ama, want to battle?"): Ama: "Oh, a duel! Honey, be nice. Ready when you are!"
```
Ama sends out Honey!
Ama studies how your pet fights...
Ama: "Honey, block its attacks!"
Honey hides behind its guard. ...
Mochi blocks it!
Mochi counters!
...
Mochi blocks it! Star Pounce is charged!
Mochi unleashes STAR POUNCE!
Honey looks hurt and scared.
Mochi: offers a snack, gently.
Ama's Honey and Mochi are friends now!
+2 coins.
```
Ama after: "Look at them, Brave Mochi. Friends now!"

**Muse Spark plan, live `/api/rival`:** Ama, same memo: `{"summary":"Honey blocks bullies and returns kindness warmly",
"rules":[last guard -> emote, intent idle -> guard, intent calm -> befriend]}`, 13.1 s, $0.0101; the same ask again came
from the KV cache in 0.9 s. A new memo took 14.9 s from the chat opening; the battle had already waited its 10 s and used a
bundled plan (a player typing the ask gives the plan more time).

Local dev, same session: Mo remembered "my Ripple beat Fluffy Sunny's pet in a duel", bond fondness 4 / respect 2, and Ama
held the news "lost a duel to Mo's Ripple" (source Mo).
