# Combat depth on live (2026-11-03, build main-CpH41EPX, then main-DyR8JZim)

Wild fight against a Bully on pets.uryto.dev, driven from the Browser pane (`__px.fight`, `battleView.update`), memo empty,
one shout pressed (key 2 = guard). Lines the battle screen said, in order:

```
A wild Bully appears!
Bully is watching you. (1-5: shout a move, 2 left)
You shout: "Guard!"
Mochi: braces and guards.
Bully strikes!
Mochi blocks it!
Bully is watching you. (1-5: shout a move, 1 left)
Mochi: tackles!
Mochi counters!
Bully strikes!
...
Mochi: tackles!
A critical hit!
...
Bully fainted. Mochi wins!
+3 coins.
```

Seen: the shout overrides one move and counts down, a blocked hit, the counter on the next attack, a crit.
Found and fixed in main-DyR8JZim: after the foe fainted the screen still said "Bully strikes! Mochi shrugs it off."
Not yet seen on live: a signature move (needs 2 blocks), damage numbers and charge pips in a screenshot (the pane was hidden).
Unit tests: `sim/sim.test.ts` (battle depth), `pixel/battle.test.ts` (shouts, signature name, fx turn, no strike after faint).
