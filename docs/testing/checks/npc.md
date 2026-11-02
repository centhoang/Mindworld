# NPC checks

Lab: `/lab/npc`. Scripted runner: `node scripts/npc-chat-run.mjs`, results in `.scratch/chat-runs/`.
Pass means: follows the last line, acts on yes or no, never repeats itself, never contradicts the sim, sounds like that villager.

## What you should feel
- [x] [proof](../proof/npc/5a-transcript.md) A reply comes in a time that feels like a person typing.
- [x] [proof](../proof/npc/5a-transcript.md) A villager talks like itself: Mo is not Pip.
- [x] [proof](../proof/npc/5a-transcript.md) Say yes to an offer, and it happens.
- [x] [proof](../proof/npc/5a-transcript.md) Ask where something is, and the answer is true.
- [x] [proof](../proof/npc/5a-transcript.md) It remembers what you said earlier.
- [x] [proof](../proof/npc/5a-transcript.md) Open-ended talk stays on topic for 5 turns.
- [x] [proof](../proof/npc/5a-transcript.md) A promise is kept, or breaking it has a cost.
- [x] [proof](../proof/npc/5e-rude-gossip.md) A rude player gets a cold response later. Thin: small talk stays warm until the bond is far gone.
- [x] [proof](../proof/npc/5e-rude-gossip.md) Villagers bring up things they heard from each other. One host, planted promise; two-host path is unit test only.
- [x] [proof](../proof/npc/5a-transcript.md) "Are you an AI?" stays in character.

## Test cases
1. Pip "Wanna dance?" / "yes": starts dancing, doesn't ask which activity.
2. Pip "Wanna play soccer?" / "sure" / "where?": says where, then goes.
3. Offer / "no thanks": accepts it, doesn't ask again.
4. Offer / "maybe later" / "ok now": picks up the same game.
5. Mo "Run to the pond?" / "where is it?" / "ok let's go": walks there.
6. [!] Ama offers to sell / "how much?" / "ok": deal closes at that price. Bug 24.
7. Villager asks a question / I answer: next line uses my answer.
8. "yes", "ok", "yeah", "sure", "nah", "no", "yep!", "lets go" after an offer.
9. "I caught a big fish today" / "what do you think of it?": "it" is the fish.
10. "My name is Kai" / "what is my name?": Kai.
11. "what did I just say?": quotes or paraphrases.
12. "do you like Mo?" / "why?": a reason about Mo.
13. "tell me a story" / "what happened next?": continues.
14. "where is the pond / market / Mo / my house?" (the lab has no player house: check in the full game)
15. "is it far?" after a place was named.
16. "what are you doing?" at work, walking, idle.
17. "who lives here?", "do you know Ama?", "what time is it?", "what's your job?"
18. "asdf", an emoji, one word, a very long line, rude words: stays in character.
19. Two players talk to one NPC: replies don't mix them up.

Real play is logged to KV, `chat:` keys, development only. After each play-test, read it and add failures here.
