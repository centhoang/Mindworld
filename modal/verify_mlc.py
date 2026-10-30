"""Independent audit of the published MLC weights (docs/FINETUNE.md stage 5): downloads them back from Hugging Face.

1. Files: every shard's md5 matches tensor-cache.json; tokenizer and chat config match mlc-ai's; prompts tokenize alike.
2. Weights: 4-bit values and scales are decoded back to float and compared with the tuned merged weights (reconstruction
   error next to the error mlc-ai's own stock conversion has against the stock weights) and with the earlier coach run,
   which proves the repo holds the stage 5 model.
3. Behaviour: greedy replies to the 200 held-out village prompts from the float weights and from the decoded MLC weights.

Run: modal run modal/verify_mlc.py --prompts .scratch/mlc/bench-prompts.json --out .scratch/mlc/verify.json
Without --prompts it only re-quantizes the merged weights and compares md5s with what is published.
The token comes from the local .env and is passed as a function argument, never written to disk or logged.
"""

import hashlib
import json
import pathlib

import modal

RUN = "llama32-1b-village-e3-r16"
EARLIER = "llama32-1b-e3-r16"
STOCK = "unsloth/Llama-3.2-1B-Instruct"
UPSTREAM = {"q4f32_1": "mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC", "q4f16_1": "mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC"}

image = modal.Image.debian_slim(python_version="3.11").pip_install("numpy==2.1.3", "torch==2.5.1", "transformers==4.57.1", "accelerate==1.1.1", "safetensors==0.4.5", "huggingface_hub==0.35.3").add_local_python_source("mlc_q4")
hf_cache = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vol = modal.Volume.from_name("llama-coach")
app = modal.App("llama-coach-mlc-verify")


def decode(folder: pathlib.Path) -> dict:
    """HF-named float tensors from an MLC folder (q/k/v and gate/up split again)."""
    import numpy as np

    import mlc_q4

    t = mlc_q4.read(folder)

    def fl(name):
        shape, dtype, raw = t[name]
        a = np.frombuffer(raw, np.float16).astype(np.float32) if dtype == "float16" else (np.frombuffer(raw, np.uint16).astype(np.uint32) << 16).view(np.float32)
        return a.reshape(shape)

    def linear(name):
        shape, _, raw = t[f"{name}.q_weight"]
        w = np.frombuffer(raw, np.uint32).reshape(shape)
        q = np.stack([(w >> np.uint32(4 * j)) & np.uint32(15) for j in range(8)], -1).reshape(shape[0], shape[1] * 8).astype(np.float32)
        return (q - 7) * np.repeat(fl(f"{name}.q_scale"), 32, 1)

    out = {"model.embed_tokens.weight": linear("model.embed_tokens"), "model.norm.weight": fl("model.norm.weight")}
    layers = 1 + max(int(k.split(".")[2]) for k in t if k.startswith("model.layers."))
    for i in range(layers):
        p = f"model.layers.{i}"
        a, m = f"{p}.self_attn", f"{p}.mlp"
        qkv = linear(f"{a}.qkv_proj")
        head = 2048 // 32
        nq, nk = 32 * head, 8 * head
        out[f"{a}.q_proj.weight"], out[f"{a}.k_proj.weight"], out[f"{a}.v_proj.weight"] = qkv[:nq], qkv[nq : nq + nk], qkv[nq + nk :]
        out[f"{a}.o_proj.weight"] = linear(f"{a}.o_proj")
        gu = linear(f"{m}.gate_up_proj")
        out[f"{m}.gate_proj.weight"], out[f"{m}.up_proj.weight"] = gu[: len(gu) // 2], gu[len(gu) // 2 :]
        out[f"{m}.down_proj.weight"] = linear(f"{m}.down_proj")
        out[f"{p}.input_layernorm.weight"] = fl(f"{p}.input_layernorm.weight")
        out[f"{p}.post_attention_layernorm.weight"] = fl(f"{p}.post_attention_layernorm.weight")
    return out


def float_weights(folder: pathlib.Path) -> dict:
    import torch
    from safetensors.torch import load_file

    out = {}
    for f in sorted(folder.glob("*.safetensors")):
        out.update({k: v.to(torch.float32).numpy() for k, v in load_file(f).items()})
    return out


def rel_err(a: dict, b: dict) -> float:
    import numpy as np

    n = d = 0.0
    for k in a:
        n += float(np.sum((a[k].astype(np.float64) - b[k]) ** 2))
        d += float(np.sum(b[k].astype(np.float64) ** 2))
    return (n / d) ** 0.5


def cosine_of_change(a: dict, ref: dict, base: dict) -> float:
    """How well (a - base) points along (ref - base): 1 = a carries the tuning in ref."""
    import numpy as np

    dot = na = nb = 0.0
    for k in ref:
        x, y = (a[k] - base[k]).astype(np.float64).ravel(), (ref[k] - base[k]).astype(np.float64).ravel()
        dot += float(x @ y)
        na += float(x @ x)
        nb += float(y @ y)
    return dot / (na * nb) ** 0.5 if na and nb else 0.0


def greedy(weights: dict | None, folder: pathlib.Path, tok, prompts: list, label: str) -> list:
    import torch
    from transformers import AutoModelForCausalLM

    model = AutoModelForCausalLM.from_pretrained(folder, torch_dtype=torch.float32).to("cuda")
    if weights is not None:
        state = {k: torch.from_numpy(v.copy()).to("cuda") for k, v in weights.items()}
        state["lm_head.weight"] = state["model.embed_tokens.weight"]
        print(label, model.load_state_dict(state, strict=False))
        model.tie_weights()
    model.eval()
    out = []
    with torch.no_grad():
        for p in prompts:
            ids = torch.tensor([p["ids"]], device="cuda")
            r = model.generate(ids, max_new_tokens=48, do_sample=False, temperature=None, top_p=None, eos_token_id=[128001, 128008, 128009], pad_token_id=0)
            out.append(tok.decode(r[0][ids.shape[1] :], skip_special_tokens=True))
    del model
    torch.cuda.empty_cache()
    return out


def template(p: dict) -> str:
    h = lambda r, c: f"<|start_header_id|>{r}<|end_header_id|>\n\n{c}<|eot_id|>"
    return "<|begin_of_text|>" + h("system", p["system"]) + h("user", p["user"]) + "<|start_header_id|>assistant<|end_header_id|>\n\n"


@app.function(image=image, gpu="T4", memory=32768, timeout=3600, volumes={"/root/.cache/huggingface": hf_cache, "/out": vol})
def verify(user: str, token: str, prompts: list) -> dict:
    from huggingface_hub import HfApi, snapshot_download
    from transformers import AutoTokenizer

    merged = pathlib.Path("/out") / RUN / "merged"
    earlier = pathlib.Path("/out") / EARLIER / "merged"
    stock_dir = pathlib.Path(snapshot_download(STOCK, allow_patterns=["*.json", "*.safetensors"]))
    tuned_f, earlier_f, stock_f = float_weights(merged), float_weights(earlier), float_weights(stock_dir)
    tuned_f = {k: v for k, v in tuned_f.items() if k != "lm_head.weight"}
    keys = set(tuned_f)
    report: dict = {"float_tuned_vs_stock_rel": rel_err({k: tuned_f[k] for k in keys}, stock_f)}

    tok = AutoTokenizer.from_pretrained(merged)
    for p in prompts:
        p["ids"] = tok(template(p), add_special_tokens=False)["input_ids"]
    report["prompt_tokens_max"] = max(len(p["ids"]) for p in prompts)
    replies = {"float": greedy(None, merged, tok, prompts, "float")}

    for quant, up_repo in UPSTREAM.items():
        repo = f"{user}/Llama-3.2-1B-Mindworld-{quant}-MLC"
        info = HfApi(token=token).model_info(repo)
        folder = pathlib.Path(snapshot_download(repo, token=token))
        up = pathlib.Path(snapshot_download(up_repo))
        cache = json.loads((folder / "tensor-cache.json").read_text())
        bad = [r["dataPath"] for r in cache["records"] if hashlib.md5((folder / r["dataPath"]).read_bytes()).hexdigest() != r["md5sum"]]
        same = {f: (folder / f).read_bytes() == (up / f).read_bytes() for f in ("mlc-chat-config.json", "tokenizer.json", "tokenizer_config.json")}
        ours, theirs = decode(folder), decode(up)
        up_tok = AutoTokenizer.from_pretrained(folder)
        replies[quant] = greedy(ours, merged, tok, prompts, quant)
        report[quant] = {
            "private": info.private,
            "sha": info.sha,
            "shards": len(cache["records"]),
            "bad_md5": bad,
            "identical_to_upstream": same,
            "tokenizer_matches_training": all(up_tok(template(p), add_special_tokens=False)["input_ids"] == p["ids"] for p in prompts),
            "tensors": len(ours),
            "missing_vs_merged": sorted(keys - set(ours))[:5],
            "recon_err_ours_vs_tuned_float": rel_err(ours, {k: tuned_f[k] for k in ours}),
            "recon_err_upstream_vs_stock_float": rel_err(theirs, {k: stock_f[k] for k in theirs}),
            "change_cos_to_tuned": cosine_of_change(ours, tuned_f, theirs),
            "change_cos_to_earlier_coach": cosine_of_change(ours, earlier_f, theirs),
        }
        del ours, theirs
    report["replies"] = replies
    return report


@app.function(image=image, cpu=4, memory=16384, timeout=1800, volumes={"/out": vol})
def rebuild(user: str, token: str) -> dict:
    """Re-quantizes each run's merged weights and compares the shard md5s with the published tensor cache: identical means
    the repo holds exactly that run. The earlier coach run is the control and must differ."""
    import numpy as np
    from huggingface_hub import hf_hub_download

    import mlc_q4

    rep = {}
    for quant, ft in (("q4f32_1", np.float32), ("q4f16_1", np.float16)):
        path = hf_hub_download(f"{user}/Llama-3.2-1B-Mindworld-{quant}-MLC", "tensor-cache.json", token=token)
        published = [r["md5sum"] for r in json.loads(pathlib.Path(path).read_text())["records"]]
        for run in (RUN, EARLIER):
            w = float_weights(pathlib.Path("/out") / run / "merged")
            out = pathlib.Path("/tmp") / quant / run
            mlc_q4.write(mlc_q4.mlc_params(lambda n: w[n], 16, ft), out)
            ours = [r["md5sum"] for r in json.loads((out / "tensor-cache.json").read_text())["records"]]
            rep[f"{quant}/{run}"] = {"shards": len(ours), "same_md5": sum(x == y for x, y in zip(ours, published)), "of": len(published)}
    return rep


@app.local_entrypoint()
def main(prompts: str = "", out: str = ""):
    env = {}
    for line in (pathlib.Path(__file__).resolve().parent.parent / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    if not prompts:
        print(json.dumps(rebuild.remote(env["HF_USER"], env["HF_TOKEN"]), indent=1))
        return
    rep = verify.remote(env["HF_USER"], env["HF_TOKEN"], json.loads(pathlib.Path(prompts).read_text(encoding="utf-8")))
    pathlib.Path(out).write_text(json.dumps(rep, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in rep.items() if k != "replies"}, indent=1))
