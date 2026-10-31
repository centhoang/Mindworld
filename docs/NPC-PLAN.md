# NPC plan: the villagers are the star (2026-10-31)

User direction: judges' eyes go to the NPC. An NPC cannot be told apart from a player: personality, habits, memory,
relationships, thoughts, plans, and every verb a player has. Pets get complex after this. All of it must fit a local
model, so the game lives on after the event with no run-time AI cost.

## 1. The bet in one paragraph
A 1B model cannot reason freely about a town, and it does not have to. **The sim does the reasoning; the model decides
and speaks.** The sim keeps typed state (promises, beliefs, prices, relationships), works out what is possible, and
retrieves what matters. The model gets a short prompt with a few valid options and picks one or writes one line. The
result looks like deep reasoning because every step is grounded in real state, and each step can be shown in the
inspector. This is the same shape as our village minds, which already reach 98.5% valid in the browser.

Honest limit: free chat from a tuned 1B stays the weakest part (replies were the weakest task in stage 5, 130/202 kept).
Muse Spark can improve chat during judging; after the event, chat stays simple but the behaviour does not.

## 2. What makes it feel human
**The demo moment (build this first, end to end).** Player to Pip: "my birthday party is tomorrow evening at the dance
floor, come?" Then, with no script:
1. Pip's model extracts the invitation (who, what, where, when) into JSON. The sim checks it is real.
2. Pip decides from relationship, personality and hobby ("loud, dances, likes you": yes; a grumpy stranger might decline
   or haggle: "only if there is cake").
3. The promise enters Pip's calendar. The inspector shows the thought.
4. Next day Pip's plan bends around it: skips soccer, buys a gift with its own coins, tells Ama, who bakes a cake.
5. Pip walks there on time. If you show up: dance, gift, memory, friendship up. If you do not: Pip waits, leaves, is
   hurt, tells Mo, and brings it up next time you talk. Mo is now cooler to you too.

| Pillar | Now | Target |
|---|---|---|
| **Same verbs** | NPCs run activities; players have other verbs | One `Verb` API for both: walk, talk, plant/water/harvest, buy/sell, list on the market, trade offer, tame or buy a pet, duel, fish, soccer, dance, invite, gift, post on the board |
| **Promises** | none | `Commitment {who, what, where, when, state, importance}`; drives planning; kept, broken and cancelled all have consequences |
| **Memory** | 30-line log + 6 facts | Typed: episodes (importance, people, place, private flag), beliefs about people ("Kai likes carrots", with source and confidence), commitments. Retrieval scores recency + importance + shared entities (Smallville's formula without embeddings) |
| **Relationships** | one number | Fondness, trust, respect, each change tied to a memory, so "why do you dislike me" has a real answer. Personality sets how much each event weighs |
| **Personality** | traits + small bias | Mostly personality, partly hobby/habit: traits weigh every choice (risk, generosity, forgiveness, punctuality). Slow change with experience |
| **Thought** | inspector plan | Thought bubbles, plus a "why" trail in the inspector: memory -> belief -> decision |
| **Goals** | daily plan | Long goals that last days: save for a pet, win a duel, grow the best pumpkin. They pull plans and spending |
| **Public context** | scene text | Town board shows prices from real trades, events, requests, time, map. NPCs read it and post on it, as players do |
| **Economy** | player only | NPC wallet, inventory, farm plot, price belief. Deals keep to sim bounds; the model picks accept, counter or refuse |
| **Gossip** | NPC chat lines | Beliefs travel in talk with their source ("Mo told me"). Private chats stay private unless the personality says otherwise, and that has consequences |
| **Initiative** | greet | NPCs come to you: offer a trade, invite you to soccer, challenge you, ask for help, follow up on what you said |
| **Indistinguishable** | NPC tag, different sprites | Same layered sprites (base + hair + tools), same speed, same name style, same bubbles, typing delay, small human errors. Inspector stays as the proof tool |

Example reasoning chains to support: A has few coins and sees carrots priced high on the board, so A plants carrots, then
offers them to the player who "likes carrots". A lost a duel to B, so A trains and asks for a rematch. A trusts C less
after a broken promise, so A asks C to pay first. A heard of a wild pet by the pond from Mo, saves, and goes to tame it.

## 3. Local-model solution
Research points the same way: split reasoning from generation, and spend calls only where they matter.
- **Sim first, then model.** Most ticks need no call. Affordable Generative Agents reached 31% of the original cost by
  reusing plans for repeated situations and compressing relationship memory. Copy both: cache by situation hash, and
  call the model for new or important moments only.
- **One attention path.** Project Sid's PIANO lets slow and fast modules run at once with one decision bottleneck so
  speech and action stay coherent. Ours: reflexes and movement run at once on rules; one scheduler queue serves the
  model by priority (player talking > promises > plans > idle chat).
- **Memory outside the model.** Fixed-persona small models with swappable memory (arXiv 2511.10277) and memory-aligned
  training (PsyMem) both support tuning the model to *use* supplied memory instead of storing it. Our rows should teach
  "answer from the listed memories, and never invent".
- **More tasks in the same model.** Same pipeline as stage 5: game prompt builders -> Muse Spark Open teacher -> game's
  own validator -> LoRA -> MLC -> browser bench. New tasks: `extract` (JSON from chat), `invite` (accept, decline,
  counter), `deal`, `belief` (reflect into a typed belief), `gossip`, `thought`, and better `reply` from memories.
  About 4,000-6,000 rows at ~$0.002 = ~$12 + ~$3 training + audit, within Modal's ~$102 credit.
- **Prompt budget.** Under ~300 tokens each: the warm-up proves that size on a GTX 1050, and at ~12 tok/s output must stay
  short. **Freeze prompts before generating data**: training rows hold the exact prompt text.
- **Throughput.** 4-6 NPCs on one host. Past that, more hosts share the load (the room already elects them).
- **Life with nobody online.** A cheap rule-only catch-up in the Durable Object advances days, trades and promises, so
  the town moved on when you return. No model needed.

After the event: minds run on players' tabs (free), no capable player means rules + cached lines, Muse Spark stays off or
capped. Nothing depends on our spending.

## 4. Build order (deadline Nov 4, 9 PM ET)
Weekly Claude quota is tight until it resets Nov 1 evening (VN time), so Codex takes isolated modules and all art.
1. Finish approved items: setup gate, chat privacy + talking status.
2. **N1 Promises:** `Commitment`, extract + decide prompts, calendar drives plan, kept/broken outcomes. Birthday slice playable.
3. **N2 Memory v2 + relationships with reasons;** inspector "why" trail; thought bubbles.
4. **N3 Verbs:** the `Verb` layer; NPC farm, wallet, market, town board; player-NPC trade.
5. **Art swap:** Sunnyside tiles + layered humans; NPCs share the player's sprites. Runs in parallel through Codex.
6. **N4 Retrain, by Nov 2 night at the latest:** freeze prompts, generate, train, convert, audit, bench. Muse Spark serves
   until the new weights land, so the demo never depends on this finishing.
7. **N5:** gossip, initiative, long goals, NPC duel and pets, indistinguishable pass.
8. Demo captures, README numbers, submission prep.

Cut line if time runs short: N1-N3 + art + retrain ship; N5 items go in order of demo value.

## 5. Backlog (nothing dropped)
- "Who is human?" mode: a round where you guess which townsfolk are players. Great demo closer if N5 lands.
- Blind test with friends, report the guess rate as an honest number.
- NPC-run events: market day, soccer league, harvest contest; NPC-made shops; rivalries and factions, romance-lite.
- More villagers; villagers that move away or arrive; day-long schedule styles (early bird, night owl).
- NPC teaches your pet, or coaches you; NPCs tame and train pets with their own memos; NPC vs NPC duels on the board.
- Personality drift from life events; moods with visible body language; dreams shown as morning thoughts.
- Letters left at your door while you are offline; a yearly town history book written by reflection.
- Voice: speech for NPCs with Muse Voice or browser TTS.
- Bigger local tier: tuned 3B in the tab for strong GPUs (~1.9 GB) as an optional upgrade.
- Very small router model for intent, with 1B for speech. FunctionGemma 270M shows the shape (tuned for a game, in the
  browser), but it is not a Meta model and is not meant for dialogue, so only a tiny Llama-based version would be
  considered.
- llama.cpp's WebGPU backend (LlamaWeb paper: 29-33% less peak memory than WebLLM, unverified): would reuse our GGUFs.
- Embedding retrieval in the tab, if keyword + entity retrieval falls short.
- Muse Glimmer / Muse Spark Open open weights where a player has the hardware.
- Pets: deeper minds, breeding, pet jobs, pet memories of owners.

## Sources
[Affordable Generative Agents](https://arxiv.org/pdf/2402.02053) ·
[Project Sid / PIANO](https://arxiv.org/pdf/2411.00114) ·
[Fixed-Persona SLMs with Modular Memory](https://arxiv.org/pdf/2511.10277) ·
[Memory-Driven Role-Playing](https://arxiv.org/pdf/2603.19313) ·
[PsyMem](https://aclanthology.org/2026.tacl-1.24/) ·
[FunctionGemma](https://blog.google/technology/developers/functiongemma/) ·
[Generative Agents summary](https://gonzoml.substack.com/p/generative-agents-interactive-simulacra) ·
[LlamaWeb](https://www.emergentmind.com/topics/llamaweb)
