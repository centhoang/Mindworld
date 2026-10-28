# Fine-tune plan: a free local coach distilled from Muse Spark (approved by the user 2026-10-28)

## Why this target (decided 2026-10-28)
- The chooser's decisions are already guarded by the memo rules (`allowedMoves`), so tuning only the chooser cannot raise win rate. What stops working after the event is **Teach** (lesson text -> memo rules), which today needs Muse Spark credits.
- So: distill Muse Spark Open's Teach into a small Meta Llama 3.2 (1B for the browser, 3B for power mode) that runs for free, **and** teach the same model the move-voice format. Scored by the existing **Prove** harness (paired seeds), not by vibes. This is the "beyond basic integration" story for Meta tooling (25) and technical depth (20), and it serves the user's goal of free play after the event.
- Llama 3.2 counts as a Meta model (Discord ruling 2026-10-27). Keep Muse Spark Open as the teacher and as the live cloud Cortex during the event.

## Baselines to beat (all in `docs/SPIKES.md`)
- Uncoached held-out win rate 60.5%. Scripted coach 88.0%. Live Muse Spark Open Teach 88.9-89.8% (+28.4..+29.3 pts, ~$0.008, 7-10 s on Baseten; Modal ~2-4 s).
- Untuned Llama: 1B browser valid 90.6% (100% with grammar), sane 40-45%, follows memo 50%; 3B native valid 100%, memo 100/92%, sane 70%. Teach by an untuned small Llama: not measured yet (step 0).

## Pipeline
0. **Baseline (cheap, first):** a `LocalCortex` (implements `Cortex` in `client/src/sim/cortex.ts`) that calls a llama-server (`/v1/chat/completions`, JSON-schema or GBNF grammar for the memo DSL) with the exact Teach prompt. Run Prove on 100 held-out lessons with untuned Llama 3.2 3B and 1B (native, `.scratch/native/bin`). This is the "before" number.
1. **Lessons:** ~3,000 diverse coaching lessons (short natural phrases a player would type: "don't hit it when it's scared", "heal-guard when low", "befriend small ones", plus typos, slang, vague and conflicting ones). Mix of DSL-templated paraphrases and Muse Spark-written variety (~$2). Hold out 300 for eval; never train on them.
2. **Teacher data (rejection sampling):** for each lesson call Muse Spark Open on Modal (`MODAL_BASE_URL`, direct script, **hard cost cap $30 and iteration cap, ledger file, resume**) with the same Teach prompt as the game; keep a memo only if it validates against the DSL (`client/src/sim/memo.ts`) **and** does not lose on the 40 train seeds (same gate as Reflect). Expect to keep roughly 60-80%.
3. **Voice data:** prompts from `buildVoicePrompt` over random memos/observations from the sim (label = `allowedMoves().moves[0]`, line from the canned bank + ~1,000 Spark-written in-character lines), mixed in at ~25% so one model does both.
4. **Train on Modal:** `modal/finetune_llama.py`, base `unsloth/Llama-3.2-{1B,3B}-Instruct` (ungated mirrors of Meta's weights; Meta's own repos are manually gated), LoRA r=16 (or full FT for 1B), chat template, 2-3 epochs, 1x H100 (card is on the workspace; H100 about $3.95/h, expect 10-30 min, <= $6). Volume for outputs; merge LoRA, save fp16, write loss/metrics JSON.
5. **Convert + serve:** llama.cpp `convert_hf_to_gguf.py` + `llama-quantize` Q4_K_M (local, binaries exist in `.scratch/native/bin`), run in llama-server.
6. **Eval = Prove:** held-out lessons -> student memo (grammar-constrained) -> validity rate -> paired-seed held-out win-rate lift vs uncoached, vs teacher memos, vs untuned Llama. Report in `docs/SPIKES.md`.
7. **Ship (only if accepted):** "Free coach" mode: `LocalCortex` used when the cloud is unavailable/over budget or the player picks local; for the browser, convert the tuned 1B to MLC `q4f32_1` (WebLLM reuses the prebuilt `Llama-3.2-1B-Instruct-q4f32_1_cs1k-webgpu.wasm`, only weights + `mlc-chat-config.json` change) and load it from a public Hugging Face repo via a custom `appConfig.model_list` entry. Hosting needs a **Hugging Face account/token: user action**. Fallback if MLC conversion is brittle: ship GGUF as power mode only.

## Acceptance (decided up front)
- Teach, with grammar-constrained decoding: >= 95% valid memos on 100+ held-out lessons; mean held-out lift >= 70% of the teacher's (teacher ~ +28 pts, so student >= ~+20 pts); win-rate numbers use the same paired seeds and CI as the Muse Spark numbers.
- Voice: 100% valid with grammar, >= 98% without; line <= 8 words.
- If the student misses, report it honestly as a negative result with the numbers; the cloud path is unaffected.

## Budget and schedule
- Teacher data <= $30 (cap), training <= $6, evals <= $5: about $40 of the ~$280 free credits (Modal $129.98 to Oct 31 2027, Meta $149.91). Log every call in `.scratch/` ledger; mock the LLM in tests.
- Oct 29-30 steps 0-3, Oct 31 steps 4-6, Nov 1 step 7 and UI, Nov 2 voice teaching, Nov 3 demo recording, Nov 4 submit. Voice teaching (speak -> Muse transcribe -> Teach) and the boss that reads the pet's memo come after this, in that order.

## Compliance notes
- Llama 3.2 community license: derived model names must start with "Llama" and the README must say "Built with Llama"; keep the license file. Repo contains only code written this week (generators, Modal scripts, eval); weights live on Hugging Face, not in the repo; no secrets.
