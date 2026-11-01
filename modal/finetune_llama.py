"""LoRA fine-tune of Meta Llama 3.2 Instruct (1B or 3B) into the game's free local coach, on Modal (docs/archive/FINETUNE.md step 4).

Data: data/finetune/sft-{train,val}.jsonl from client/src/finetune/build-sft.ts (Teach memos distilled from
Muse Spark Open + pet voice lines), in the exact prompts the game sends. Loss is on the assistant reply only.
Output on the `llama-coach` volume under <run>/: merged fp16 weights (for MLC/WebLLM later), a Q4_K_M GGUF for
llama-server, and metrics.json (loss curve, eval loss, quick JSON-validity check on val Teach prompts).

Chat template: a plain Llama 3 template without the "Cutting Knowledge Date / Today Date" header that the HF
template adds, which is what llama-server's built-in llama3 template produces, so training and serving match.
It is saved into the tokenizer, so the GGUF carries the same template.

Run:      modal run --detach modal/finetune_llama.py --size 3B --epochs 2
Download: modal volume get llama-coach <run>/model-Q4_K_M.gguf .scratch/finetune/
Weights are Llama 3.2 Community License derivatives ("Built with Llama"); they live on the volume / Hugging Face,
never in this repo.
"""

import json
import pathlib

import modal

LLAMA_CPP_TAG = "b11934"  # same build as the local llama-server in .scratch/native/bin
BASES = {"1B": "unsloth/Llama-3.2-1B-Instruct", "3B": "unsloth/Llama-3.2-3B-Instruct"}  # ungated mirrors of Meta's weights
MINUTES = 60

LLAMA3_TEMPLATE = (
    "{{- bos_token }}"
    "{%- for m in messages %}"
    "{{- '<|start_header_id|>' + m['role'] + '<|end_header_id|>\\n\\n' + (m['content'] | trim) + '<|eot_id|>' }}"
    "{%- endfor %}"
    "{%- if add_generation_prompt %}{{- '<|start_header_id|>assistant<|end_header_id|>\\n\\n' }}{%- endif %}"
)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git", "cmake", "build-essential")
    .uv_pip_install(
        "torch==2.8.0",
        "transformers==4.56.2",
        "trl==0.23.0",
        "peft==0.17.1",
        "accelerate==1.10.1",
        "datasets==4.1.1",
        "sentencepiece==0.2.1",
        "protobuf==6.32.1",
    )
    .run_commands(
        f"git clone --depth 1 --branch {LLAMA_CPP_TAG} https://github.com/ggml-org/llama.cpp /llama.cpp",
        "pip install /llama.cpp/gguf-py",
        "cmake -S /llama.cpp -B /llama.cpp/build -DGGML_CUDA=OFF -DLLAMA_CURL=OFF -DLLAMA_BUILD_TESTS=OFF",
        "cmake --build /llama.cpp/build --target llama-quantize -j 8",
    )
    .env({"HF_XET_HIGH_PERFORMANCE": "1", "TOKENIZERS_PARALLELISM": "false"})
)

hf_cache = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
out_vol = modal.Volume.from_name("llama-coach", create_if_missing=True)
app = modal.App("llama-coach-ft")


def to_prompt_completion(rows):
    # TRL computes the loss on "completion" only for prompt-completion datasets.
    return [{"prompt": r["messages"][:-1], "completion": r["messages"][-1:], "task": r["task"]} for r in rows]


@app.function(image=image, gpu="H100", timeout=90 * MINUTES, volumes={"/root/.cache/huggingface": hf_cache, "/out": out_vol})
def train(train_rows: list, val_rows: list, size: str, epochs: float, lr: float, rank: int, run: str) -> dict:
    import subprocess
    import time

    import torch
    from datasets import Dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from trl import SFTConfig, SFTTrainer

    t0 = time.time()
    out = pathlib.Path("/out") / run
    out.mkdir(parents=True, exist_ok=True)
    base = BASES[size]
    tok = AutoTokenizer.from_pretrained(base)
    tok.chat_template = LLAMA3_TEMPLATE
    tok.pad_token = "<|finetune_right_pad_id|>"
    model = AutoModelForCausalLM.from_pretrained(base, torch_dtype=torch.bfloat16, attn_implementation="sdpa").to("cuda")

    train_ds = Dataset.from_list(to_prompt_completion(train_rows)).remove_columns("task")
    val_ds = Dataset.from_list(to_prompt_completion(val_rows)).remove_columns("task")
    cfg = SFTConfig(
        output_dir=str(out / "ckpt"),
        num_train_epochs=epochs,
        learning_rate=lr,
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=16,
        gradient_accumulation_steps=1,
        max_length=2048,
        bf16=True,
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="no",
        report_to="none",
        seed=7,
    )
    peft = LoraConfig(r=rank, lora_alpha=2 * rank, lora_dropout=0.05, target_modules="all-linear", task_type="CAUSAL_LM")
    trainer = SFTTrainer(model=model, args=cfg, train_dataset=train_ds, eval_dataset=val_ds, processing_class=tok, peft_config=peft)
    trainer.train()
    history = trainer.state.log_history
    train_min = (time.time() - t0) / 60

    # Quick check before merging: greedy replies to val Teach prompts must parse as a memo.
    teach_val = [r for r in val_rows if r["task"] == "teach"][:24]
    m = trainer.model.eval()
    valid = 0
    samples = []
    for r in teach_val:
        ids = tok.apply_chat_template(r["messages"][:-1], add_generation_prompt=True, return_tensors="pt").to("cuda")
        with torch.no_grad():
            gen = m.generate(ids, max_new_tokens=700, do_sample=False, pad_token_id=tok.pad_token_id)
        text = tok.decode(gen[0, ids.shape[1]:], skip_special_tokens=True)
        try:
            ok = isinstance(json.loads(text).get("rules"), list)
        except Exception:
            ok = False
        valid += ok
        if len(samples) < 4:
            samples.append({"lesson": r["messages"][1]["content"][-160:], "reply": text[:400]})

    merged = trainer.model.merge_and_unload()
    merged_dir = out / "merged"
    merged.save_pretrained(merged_dir, safe_serialization=True)
    tok.save_pretrained(merged_dir)
    f16 = out / "model-f16.gguf"
    q4 = out / "model-Q4_K_M.gguf"
    subprocess.run(["python", "/llama.cpp/convert_hf_to_gguf.py", str(merged_dir), "--outtype", "f16", "--outfile", str(f16)], check=True)
    subprocess.run(["/llama.cpp/build/bin/llama-quantize", str(f16), str(q4), "Q4_K_M"], check=True)
    f16.unlink()

    metrics = {
        "run": run,
        "base": base,
        "size": size,
        "epochs": epochs,
        "lr": lr,
        "rank": rank,
        "n_train": len(train_rows),
        "n_val": len(val_rows),
        "train_loss": [h["loss"] for h in history if "loss" in h],
        "eval_loss": [h["eval_loss"] for h in history if "eval_loss" in h],
        "val_teach_json_valid": f"{valid}/{len(teach_val)}",
        "samples": samples,
        "train_minutes": round(train_min, 1),
        "total_minutes": round((time.time() - t0) / 60, 1),
        "gguf_mb": round(q4.stat().st_size / 1e6),
    }
    (out / "metrics.json").write_text(json.dumps(metrics, indent=1))
    out_vol.commit()
    return metrics


@app.local_entrypoint()
def main(size: str = "3B", epochs: float = 2.0, lr: float = 2e-4, rank: int = 16, run: str = ""):
    data = pathlib.Path(__file__).resolve().parent.parent / "data" / "finetune"
    read = lambda p: [json.loads(l) for l in (data / p).read_text(encoding="utf-8").splitlines() if l.strip()]
    run = run or f"llama32-{size.lower()}-e{epochs:g}-r{rank}"
    metrics = train.remote(read("sft-train.jsonl"), read("sft-val.jsonl"), size, epochs, lr, rank, run)
    summary = {k: v for k, v in metrics.items() if k not in ("train_loss", "samples")}
    summary["train_loss_first_last"] = [metrics["train_loss"][0], metrics["train_loss"][-1]] if metrics["train_loss"] else []
    print(json.dumps(summary, indent=1))
