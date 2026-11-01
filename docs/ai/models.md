# Models

| Model | Where | Used for | State |
|---|---|---|---|
| Muse Spark Open (`meta-models/muse-spark-open-1026`) | Baseten, Modal | Teacher for training data, Teach, cloud fallback | Off in `LOCAL_ONLY` |
| Tuned Llama 3.2 1B (N4, `llama32-1b-n4-e3-r16`) | Browser, WebLLM | All minds | Live, 97.0% valid on 300 held-out cases |
| Tuned Llama 3.2 3B (`llama32-3b-n4-e2-r16`) | Modal volume | Candidate for chat | Trained, not benched, not converted |
| Meta transcriber | Meta API | Voice teaching | Live |

## Pipeline
Game prompt builders -> Muse Spark teacher -> game's validator -> LoRA on Modal -> merge -> MLC (browser) and GGUF (native) -> bench -> publish to private HF.
Scripts: `client/src/finetune/`, `modal/finetune_llama.py`, `modal/convert_mlc.py`, `modal/publish_coach.py`.
Each new weight set gets a new URL path, because browsers cache by URL.

## Facts worth keeping
- WebLLM runs one request at a time per loaded model.
- Prefill over ~190 tokens in one dispatch kills the 1050's GPU process: `limitPrefill` sets 128.
- WebLLM ships a prebuilt 3B library, so a tuned 3B needs only `convert_mlc.py` with 3B sources.
- MLC q4 and Q4_K_M are different formats: quote browser numbers for the browser model.
- Freeze prompts before generating data: rows hold the exact prompt text.
- Local run on 1050: see the table in `npc.md`. Older notes of 12 and 27 tok/s are not comparable.

## Spend
Credits left: Meta ~$149.9, Modal ~$100. Training a size costs ~$1.50. Data so far: $10.86. Cap rules: `CLAUDE.md`.

Full record: `archive/FINETUNE.md`, `archive/SPIKES.md`.
