# NPC minds and chat

**Goal:** a player cannot tell a villager from a human. **Bet:** the sim reasons; the model decides and speaks.

## Villagers
Elder (herbs), Mo (fishing), Ama (market stall), Pip (wood). Each has a persona, a job with hours, a wallet, a farm plot and a long goal. Any of them can skip a shift or refuse a deal, with a reason.

## How a mind works
- **Sim first:** most ticks need no model. Questions with one true answer come from the sim (`directions.ts`, `offers.ts`, `scene.ts`).
- **Model tasks:** plan, choose, line, emote, reflect, extract, decide, deal. Short prompts, a few valid options, output checked by the game.
- **Memory:** a rolling log, facts, promises, and bonds (fondness, trust, respect), each tied to a memory.
- **Promises:** invitation -> extract -> decide -> calendar -> plan bends -> kept or broken -> consequences and gossip.
- **Hosting:** minds run in a player's tab. The room elects a host per villager and hands over on leave.

## Chat today
- Offers work: yes, no, later and "where?" all act on the offer.
- True answers work.
- **Free talk tiers:** sim, then Muse Spark with card, memories and the last 8 lines (`CLOUD_CHAT`), then the local 1B. The cloud prompt is `VILLAGER_STYLE` in `worker/src/chat.ts`, not frozen.
- **Free talk on the 1B alone is weak** (bug 11): it drifts, and repeats topics.
- `cleanReply` strips bond notes and repeat invitations.
- Prompts are frozen at af455c4: a text change needs a retrain.

## Speed on the GTX 1050 (2026-11-02, same test)
| | 1B stock | 3B stock |
|---|---|---|
| Download / VRAM | ~0.9 GB / ~0.9 GB | 1.82 GB / 2.95 GB |
| Decode | 7.2 tok/s | 2.7 tok/s |
| Prefill | 60-70 tok/s | 20-32 tok/s |
| 48 tokens out, 330 tokens in | 11.7 s | 29.9 s |

The 3B is ~2.7x slower.

## Tuned 3B vs tuned 1B (2026-11-02, native GGUF, `finetune/chat-bench.ts`, read by Claude)
| | Tuned 1B | Tuned 3B |
|---|---|---|
| Valid, 300 held-out cases | 97.0% | 97.3% |
| `reply` valid | 65/73 | 65/73 |
| 5-turn talks that stayed on topic | 0 of 10 | 0 of 10 |

**Result: 3B stays out.** It knows the village better (the 1B says it has no idea who Mo is) and takes rudeness better, but it still loops and pushes soccer. That is not clearly better for 2.7x the wait and 3x the VRAM. Free talk needs the cloud tier; local tier is the 1B.

## Options for chat
**Decided (user, 2026-11-02):** A, tiers: sim, then cloud Muse Spark for free talk with a cap, then local. Plus D. Build: `../RESTRUCTURE.md` step 5a.

| | Idea | Good | Bad |
|---|---|---|---|
| **A (chosen)** | Tiers: sim answers first, then 1B or a cloud Meta model for free talk during the event, with a cap | Fast, best talk for judges, strong Meta tooling story | Free talk gets weaker when the cap ends |
| B | Tuned 3B only on GPUs that pass a speed probe; 1B otherwise | Free forever, better talk if the bench proves it | Slow on weak GPUs; two weight sets to host |
| C | 3B everywhere | One model | 30 s replies on a 1050, 2.95 GB VRAM shuts out many players |
| D | Better 1B: shorter prompts, 15-20 word replies, intent routing to line banks | Cheapest, helps all options | Won't fix open-ended talk alone |

Whichever wins, do D. A short reply (20 tokens, 150 in) takes ~6 s on the 1B and ~14 s on the 3B. A "typing..." bubble makes that feel like a person.

Rule: the game must still work free after the event, so turning the cloud tier off must leave the game playable.

Design backlog and research sources: `archive/NPC-PLAN.md`.

## Village Gazette and watching villagers (P5, 2026-11-04)
- **Gazette** (`mind/gazette.ts`, `game/gazette-api.ts`, worker `gazette.ts`, `/api/gazette`). The client that hosts
  villagers sends their notable memories (imp >= 4: promises 8, duels 6, gifts 6, deals 5, watched fights 4, goals
  4-5; everyday doings fill a quiet day; `planned:` and encoded `x|y` lines are skipped), up to 10, plus prices.
  It uses yesterday's notes, else the latest lived day (the village only lives while someone is online). Muse Spark
  1.3 on the Meta Model API writes 3 headlines; KV cache `gazette:paper:<room>:<day>` (2 days), a 60 s busy key so
  one writer at a time, $1/UTC day + ledger + quota `gazette` (12 per client, 300 a day). A non-host sends no notes and
  only reads; 4 tries 15 s apart, then rules (`rulesHeadlines`, from the same notes). Live cost ~$0.006 a paper.
- Weak spot: plain `remember()` entries live in the host's tab only (the room keeps the relayed `mem` lines), so a
  reload or host hand-over mid-day loses that day's everyday notes; promises, duels, trades and bonds are relayed.
- **Watching villager** (`game/cheer-api.ts`, worker `cheer.ts`, `/api/cheer`). At a fight's start the nearest villager
  within 16 tiles, awake and not indoors (`Overworld.watcher`, the rival's owner excluded) is the watcher; one Muse
  Spark Open call (persona from `chat.ts PERSONA`, the villager's feeling about the player) writes its line for win,
  loss and friends; said at the end, waiting 1.5 s at most; a draw and every failure use the villager's own lines.
  The villager remembers "watched <player>'s pet <pet> beat <foe>" (Gazette news). Cap $1/UTC day, quota `cheer`.
- The inspector (I) names what answered a mind's last line (`serviceLabel`, plain words first).

## Villagers talk to each other and tell campfire stories (P5d, 2026-11-04)
- Worker `banter.ts`, `/api/banter`; client `game/banter-api.ts`, set as `NpcVillage.banter` when `CLOUD_LIVELY`.
  One Muse Spark Open call writes a whole talk: `{kind: chat|story, who, speak, notes, listeners, place, time, said,
  lines}`. `speak` = the villagers this machine hosts: only they get lines. Short third-person cards per villager live
  on the worker (`CARD`); the client sends each villager's notes (`NpcVillage.notesOf`, 600 chars): what it is doing,
  feelings (bonds, fondness toward the other), facts, notable memories (imp >= 4) then the latest, prices as coins,
  without its own small talk ("I said to", "said hello to") or plan lines. A villager hosted elsewhere is known only
  by what it does and any memory handed over earlier.
- When: two villagers I both host meet (`MindHub.talk` asks `cloudTalk` for the whole talk first, then plays it with
  a "..." pause, 3.6 s a line, the room's 3 s per speaker); a villager on another machine talks to mine (`speak` ->
  `mateLine`: my villager's next line, `lines: 1`, the talk so far; decided once per talk); evening at the campfire
  with a player within 8 tiles (`campfire()`/`storyNow()`, once a game day per machine): the hosted sitter with the
  most notable memory today tells (Elder first on a tie), hosted sitters react, all keep sitting (`left` 80).
- Cost guard: only while a player is within 14 tiles (the room's hearing distance), at most one cloud talk per 40 s
  per machine, $1/UTC day (KV `banter:spend:<day>`), ledger, quota `banter` (150 per client, 3000 a day). Live
  ~$0.005 a call, 3.8-4.2 s.
- Fallbacks: no cloud, a failure, nobody near: the hub's old path (local model line by line when loaded, else
  scripted). A story without the cloud: `rulesStory` (the teller's opener, "Today <its top note today>.", else an old
  tale; a canned reaction each). No new local prompt (local prompts are frozen).
- Campfire stories also call `NpcVillage.onStory` (main.ts `storyCard`): a postcard for a player who sat by the fire.
- Memory: each talker remembers the other's line (`talked with Mo: "..."`); the teller remembers `told <players> a
  campfire story: "..."` (imp 4, so the Gazette can report it), listeners `heard <teller>'s campfire story with ...`.

## Postcards (P5e, 2026-11-04)
- Worker `postcard.ts`, `/api/postcard`; client `game/postcard-api.ts` (`Album`), `pixel/album.ts` (`AlbumView`),
  wired in `main.ts`. Moments: a win or a new friend (`FightDeps.postcard`, all three fight kinds; the watcher is in
  the picture), and a campfire story a player sat through (`onStory`, on the storyteller's host only).
- The client sends only game values: scene (`win|friends|campfire`), names, the pet's genes as `petLook` gives them
  (hue, accent hue, ears, tail, horns, pattern, kind for a tamed pet), the foe (wild kind or owner), the villagers
  there. The worker checks them against its own lists and writes the whole prompt (cozy pixel-art keepsake, front
  view, "no text" since image text is unreliable); the caption is drawn by the game under the picture.
- Muse Image 1.0, $0.01 an image, size 1536x1024 (3:2). Caps: $2/UTC day (KV `postcard:spend:<day>`), the ledger's
  Meta total, quota `postcard` (8 per client, 200 a day). An upstream error is not booked (not billed); a timeout books
  $0.01. One card per kind of moment per game day per device; no card = the slot comes back; `rate_limit` = one more
  try after 20 s. Album: `localStorage["petmind.album.v1"]`, last 12, shrunk to 480 px webp, oldest dropped if full.
- Not shared with the room and not stored on the server: the album lives on the player's device.
