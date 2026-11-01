# Pet minds

**Role:** your companion, and the proof that AI teaching changes behaviour. NPCs come first; pets get deeper after them.

## What a pet is
- Hatched with random genes, which set its look and persona.
- Follows you, reacts on its own, has needs and moods, and joins the village's day.
- Wild pets can be befriended and join your party.

## Teach and Prove
- **Teach:** you give a lesson in words. Muse Spark Open or the tuned local model turns it into a memo: at most 8 rules in a small DSL.
- **The memo runs the fight:** a pure policy. Same seed, same luck.
- **Prove:** paired seeds compare the pet with and without the memo. It reports a real win-rate change, not vibes.
- Target lift: +15 points. Teacher +21.6, tuned 1B about +21. Details: `models.md`.

## Mind
Needs, plan, choose, emote and reflect use the same scheduler as villagers. Lines are short. The persona comes from genes and the memo.

## Other model use
- Voice teaching goes through Meta's transcriber.
- Babble is local audio, with no model.

## Open
- Pet chat has no check list beyond `../testing/checks/pet.md`.
- Backlog: pet jobs, breeding, deeper memories of owners. Not before NPC chat is good.
