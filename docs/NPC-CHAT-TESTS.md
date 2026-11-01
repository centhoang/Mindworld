# NPC chat tests

Run before every play-test request, on the real model. The user should never be the first to find a broken conversation.

**How:** start the rig (`docs/HISTORY.md`, "Game on the 1050"), then `node scripts/npc-chat-run.mjs`: it runs `scripts/npc-chat-test.js` and saves to `.scratch/chat-runs/`. Add new cases to that script.

**Pass:** the reply follows the previous line, acts on a yes or no, never repeats its own question, never contradicts the sim, and sounds like that villager.

## Offers and answers
1. Pip: "Wanna dance?" / me: "yes" / must start or agree to dancing, and not ask which activity.
2. Pip: "Wanna play soccer?" / "sure" / "where?" / says where, then goes.
3. Pip offers a game / "no thanks" / accepts it and does not ask again.
4. Pip offers a game / "maybe later" / "ok now" / picks up the same game.
5. Mo: "Want to run to the pond?" / "where is it?" / "ok let's go" / walks there.
6. Ama offers to sell / "how much?" / "ok" / the deal closes at that price.
7. Any villager asks a question / I answer it / the next line uses my answer.
8. Short replies after an offer: "yes", "ok", "yeah", "sure", "nah", "no", "yep!", "lets go".

## Following the talk
9. "I caught a big fish today" / "what do you think of it?" / "it" is the fish.
10. "My name is Kai" / "what is my name?" / answers Kai.
11. "what did I just say?" / quotes or paraphrases it.
12. "do you like Mo?" / "why?" / gives a reason about Mo.
13. "tell me a story" / "what happened next?" / continues the story.

## True answers
14. "where is the pond / market / Mo / my house?"
15. "is it far?" after a place was named.
16. "what are you doing?" at work, walking and idle.
17. "who lives here?", "do you know Ama?", "what time is it?", "what's your job?"

## Odd input
18. "asdf", an emoji, one word, a very long line, rude words: stays in character.
19. Two players talking to one NPC: replies do not mix them up.
20. "are you an AI?": stays in character.

## Log of real play
The NPC host logs every line said to a player to KV (`chat:` keys, 14 days; read with wrangler, see HANDOFF). After each user play-test, read it, add each failure to docs/BUGS.md, and turn it into a case above.
