# Submission form: questions and draft answers

Form: cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit (a dialog; read from the user's signed-in Chrome,
2026-11-04, read only). **The user clicks Submit, ticks the consent box and adds team members.** Claude may type the
text answers in only when the user asks for it on the day; never the submit button.
Bonus prizes this entry fits (`event.md`): Best Build on Meta Open Weight Models ($10k, Muse Spark Open on partner
inference: Baseten and Modal), Best Creative Build ($5k, Muse Image: postcards), Most Viral ($20k, needs the user's X post),
Best Agentic Use-Case ($5k, rivals that plan, rehearse and adapt). Name them in the text where they fit.

## The fields, in form order
| # | Field | Kind | Answer |
|---|---|---|---|
| 1 | Team Name | text | **[USER]** e.g. "Mindworld" or the user's handle |
| 2 | Team Members | list (the user is already in) | Solo: nothing to add |
| 3 | Which track? (required) | Indie Developer / Startups | **Indie Developer Track** |
| 4 | Which problem statement? (required) | Build for Your World / Push the Frontier | **Build for Your World** |
| 5 | Most Viral: X post link | text | `https://x.com/urytocent/status/2118075780181991721` (posted 2026-11-05) |
| 6 | Project Description | long text | Draft A below |
| 7 | Public GitHub Repository | text | `https://github.com/centhoang/Mindworld` once the user renames it (old name redirects), public; pushed 2026-11-05 `07f5093` |
| 8 | 3-Minute Demo Video | text (YouTube) | `https://youtu.be/jvC3sT4ItdI` (public) |
| 9 | Describe your use of Meta products | long text | Draft B below |
| 10 | Why are Meta's models important to your solution? | long text | Draft C below |
| 11 | Feedback on partner technologies (Fireworks, Modal, Baseten) | text | Draft D below |
| 12 | How likely to build with Meta Model API? (required) | 5 options | **[USER]** opinion |
| 13 | Overall opinion of Meta Model API? (required) | 5 options | **[USER]** opinion |
| 14 | Consent: Meta and CV may use, publish, share the submission | checkbox | **[USER]** ticks it (accepting terms) |
| 15 | Recommend Meta Model API (0-5) | radio | **[USER]** |
| 16 | Recommend Muse Code (0-5) | radio | **[USER]** (we did not use Muse Code; Codex and Claude Code built it) |
| 17 | Biggest obstacle | radio, 14 options incl. "Something else (please specify)" | **[USER]**; facts to pick from: Modal refused the big GPUs without a card (Glimmer endpoint never ran), the 1B in a browser on a GTX 1050 needed prefill limits |
| 18 | Meta's models vs others for the same work | radio | **[USER]** |
| 19 | What matters most when choosing a model | radio | **[USER]**; this project's answer would be "Open weights or self-hosting" |
| 20 | Hardest thing about switching | radio | **[USER]**; fact: our product is tuned to the model (frozen prompts, LoRA on Llama 3.2) |
| 21 | What would stop production use of Meta's models | radio | **[USER]** |

## Draft A: Project Description
Mindworld is a free browser village where the villagers are as alive as the players. Invite Pip to your birthday and
Pip decides whether to come, skips a work shift for it, walks over on time, and remembers if you never show up; then
Pip tells Ama, and Ama won't sell to you until you say sorry. Villagers keep jobs, trade at prices set by real deals,
hold grudges with real reasons, tell campfire stories from their memories, and challenge your pet to duels, adapting
their plan to beat yours. A village newspaper reports what really happened that day, and a postcard paints the moments
you shared.

The problem: AI characters in games either cost a cloud call per line (too expensive to be free) or run on one strong
device (shutting out everyone else). Mindworld shares local AI across the players instead. A tuned Llama 3.2 1B runs in
the browser tab (WebGPU, no install); the room ranks each player's machine by measured speed and gives the villagers'
minds to the strong ones, and everyone else sees the same village. When a host leaves, the minds move to the next
player with their memories, so the village stays alive to the last person. Anyone can play on any hardware, for free:
with no model in the tab, another player's machine, a capped cloud call, or the rules think for you. Meta's cloud
models add what a 1B cannot: richer talk, the newspaper, postcards and rival plans, every call behind a daily cap with
a free fallback.

The game reasons, the model chooses: the simulation offers only the valid options, so a villager can never promise
what the world forbids.

## Draft B: Use of Meta products
- **Llama 3.2 1B Instruct, fine-tuned by us** (LoRA on Modal, distilled from Muse Spark Open, published as MLC and GGUF
  on Hugging Face): every villager's and pet's mind in the browser via WebLLM: plan, choose among the sim's valid
  options (grammar-constrained), speak, emote, reflect. 97.0% valid decisions on 300 held-out cases.
- **Muse Spark Open** (Baseten `meta-models/muse-spark-open-1026`, and a Modal endpoint): the teacher for our training
  data; villager chat when nobody nearby has a model; villagers talking to each other and evening campfire stories from
  their memories; a watching villager's line after a fight; Teach (a plain-words lesson becomes a checked rule memo);
  rival plans that our sim rehearses before the rival uses them; on the Modal endpoint, an optional cloud move chooser
  for the pet (`?cloudmoves`, off by default).
- **Muse Spark 1.3** (Meta Model API): the Village Gazette, one paper per room and game day from the day's real events;
  the coach review ("learn from my fights") that writes a revised memo.
- **Muse Image 1.0** (Meta Model API): postcards of your pet and the friends who were there, painted from the pet's
  genes and the real moment (a win, a new friend, a campfire story), with frames of the game itself as reference
  pictures so every card looks like the village.
- **Muse Voice Transcribe** (Meta Model API): teaching your pet by voice.
Every cloud call goes through our Cloudflare Worker with per-player and per-day USD caps and a free fallback.

## Draft C: Why Meta's models matter
Open weights are what make the game free. Only an open model can be fine-tuned and shipped into every player's browser,
so the everyday minds cost nothing per line and keep working after the event's credits run out. Llama 3.2 1B is small
enough for a laptop GPU in a tab; Muse Spark Open taught it (we distilled Spark's answers on our own game prompts), so
the small model plays like a much bigger one on our tasks. The Muse family then covers the moments a 1B cannot: Spark
for richer talk, rival plans and the newspaper, Muse Image for the keepsakes, Voice Transcribe for speaking to your pet.
One model family from the browser to the cloud means one prompt style, one validator and one fallback chain.

## Draft D: Partner feedback (one line field)
"Baseten: Muse Spark Open answered fast and reliably all week, and its credits covered our training data. Modal: easy
LoRA fine-tuning and conversion for Llama 3.2; the big GPUs (for a Glimmer endpoint) needed a card first. Fireworks:
not used."
**[USER]** edit to taste.

## X post (Most Viral, field 5): draft for the user
The form wants the post's link, so the user posts it after Access goes and before pressing Submit (engagement counts
through Nov 8). Attach a 20-40 s clip: the birthday promise or the hand-over. **[USER]** posts; Claude never does.
No tag, hashtag or handle is required (details page, #faqs and #announcements read 2026-11-04): post the demo on X, submit the link; likes, reposts and comments count until Nov 8 EOD. Tagging @AIatMeta is optional, the user's call.
> I built Mindworld for the Meta Global AI Developer Hackathon: a free browser village where the villagers think for themselves,
> on a Llama we fine-tuned, running in the players' own tabs. Invite Pip to your birthday and Pip skips work to come.
> Don't show up, and the whole village hears about it. Play free, no install: mindworld.uryto.dev

## Before submitting (P8 order is in `plan/final-plan.md`)
- Links work from outside: game (`mindworld.uryto.dev`), repo public, HF repos public, video public or unlisted.
- The video opens with what pre-existed vs what was built (rules).
- Repo dates (checked 2026-11-04): first commit `202921d` Oct 26 12:14 ET, 14 min after the noon kickoff, only rules
  and notes (CLAUDE.md, HANDOFF.md, event notes, .gitignore); the first code commit `586e96a` is Oct 27 11:47 ET, inside
  the building period. Fine as is: nothing before kickoff, no code before Oct 27.
