# Birthday promise, start to end (deployed build, 2026-11-03)

Two tabs on pets.uryto.dev, room connected, builds 84964532 and 1c63930a. `birthday.jpg`: kept, decor, soccer, picnic.

**What the driver shortened:** only the walking. It moved the player beside a villager to talk and beside them at the party. The clock was not sped up: these ran on the shared world clock, 12 real minutes per game day. Promises, the villagers' trips, moods and gifts were the game's own. Wild fights were held off.

## Kept (day 809, hour by the game clock)
- 7.1 "Come to my birthday party tonight, Pip!" > "Yes, Sleepy Clover! I will be there for the birthday party. Meet me at the lawn." The promise opens: dance, birthday party, evening.
- 17.0 Pip: "Time to go, I promised Sleepy Clover!" Pip walks to the lawn with no driver help.
- 17.5 Pip: "Happy birthday, Sleepy Clover! I brought you carrot." Promise kept. Next load of that save: basket `{carrot: 1}`.

## Broken (day 811, new save)
- 6.9 Pip agrees to the birthday party, and to soccer at noon.
- 11.0 The player goes to soccer: "Glad you came". Promise kept.
- 17.0 Pip leaves for the party. The player stays away.
- 22.0 Pip: "Fluffy Sunny never came..." Promise broken, trust -20, fondness -5.
- 22.5 "why are you upset with me?" > "Because you stood me up at the birthday party." "nice day" > "it's night now, not day. I'm still upset you stood me up at the birthday party"
- 2.9 Pip, unasked: "Fluffy Sunny, you stood me up at the birthday party."

## Found and fixed
The plane never showed the birthday decor: it lived only in the old pixel view. Bunting and balloons now go up on the plaza for the day (unit test, and seen on live). Only a tab hosting that villager shows them: the promise list lives with the host.

## Weak spots, not blockers
- The local model at 4.5 had Pip say "I heard you kept your birthday party promise!" a day after the broken one.
- A tab's promise list blanked for a short while when hosts changed (20.1, 2.1), then came back; no promise was lost.
- Ama had not heard the news when asked at 22.7, before any villagers met. Spread after a real break was not seen in this run; `proof/npc/5e-rude-gossip.md` shows the spread from a planted one.
