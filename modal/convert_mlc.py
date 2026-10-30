"""Convert a tuned Llama 3.2 1B on the `llama-coach` volume to MLC q4f32_1 weights for WebLLM (docs/FINETUNE.md step 7).

The browser reuses the prebuilt Llama-3.2-1B-Instruct q4f32_1 WebGPU library, so only the weights change. The weights
come from `mlc_q4.py` (plain NumPy; the mlc_llm wheels would not install or load). `--check` first converts Meta's stock
1B the same way and compares it with mlc-ai's published weights: same names, shapes, dtypes and (nearly all) bytes
means the library runs ours as it runs theirs.
Output: <run>/mlc/ on the volume (shards + tensor cache + mlc-ai's chat config and tokenizer files, unchanged).
Run: modal run modal/convert_mlc.py --run-name llama32-1b-village-e3-r16 [--quant q4f16_1] [--check]
Output folder: <run>/mlc (q4f32_1) or <run>/mlc-f16 (q4f16_1).
"""

import json
import pathlib

import modal

UPSTREAM = {"q4f32_1": "mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC", "q4f16_1": "mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC"}
OUT = {"q4f32_1": "mlc", "q4f16_1": "mlc-f16"}
STOCK = "unsloth/Llama-3.2-1B-Instruct"

image = modal.Image.debian_slim(python_version="3.11").pip_install("numpy==2.1.3", "huggingface_hub==0.35.3").add_local_python_source("mlc_q4")
hf_cache = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vol = modal.Volume.from_name("llama-coach")
app = modal.App("llama-coach-mlc")


def load_safetensors(folder: pathlib.Path):
    """name -> float32 array getter over every *.safetensors file (bf16/f16/f32), without torch."""
    import numpy as np

    index = {}
    for f in sorted(folder.glob("*.safetensors")):
        raw = f.read_bytes()
        n = int.from_bytes(raw[:8], "little")
        header = json.loads(raw[8 : 8 + n])
        for name, t in header.items():
            if name != "__metadata__":
                index[name] = (raw, 8 + n, t)

    def get(name: str):
        raw, base, t = index[name]
        a, b = t["data_offsets"]
        buf = raw[base + a : base + b]
        if t["dtype"] == "BF16":
            arr = (np.frombuffer(buf, dtype=np.uint16).astype(np.uint32) << 16).view(np.float32)
        else:
            arr = np.frombuffer(buf, dtype={"F16": np.float16, "F32": np.float32}[t["dtype"]]).astype(np.float32)
        return arr.reshape(t["shape"])

    return get, index


def convert(src: pathlib.Path, out: pathlib.Path, quant: str) -> dict:
    import numpy as np

    import mlc_q4

    get, index = load_safetensors(src)
    layers = 1 + max(int(k.split(".")[2]) for k in index if k.startswith("model.layers."))
    return mlc_q4.write(mlc_q4.mlc_params(get, layers, np.float16 if quant == "q4f16_1" else np.float32), out)


def compare(ours: pathlib.Path, theirs: pathlib.Path) -> dict:
    import numpy as np

    import mlc_q4

    a, b = mlc_q4.read(ours), mlc_q4.read(theirs)
    rep = {"names_match": set(a) == set(b), "missing": sorted(set(b) - set(a))[:5], "extra": sorted(set(a) - set(b))[:5]}
    same_meta = exact = 0
    worst = []
    for name in set(a) & set(b):
        (sa, da, xa), (sb, db, xb) = a[name], b[name]
        if sa == sb and da == db and len(xa) == len(xb):
            same_meta += 1
        if xa == xb:
            exact += 1
            continue
        if len(xa) == len(xb):
            if da == "uint32":
                ua, ub = np.frombuffer(xa, np.uint32), np.frombuffer(xb, np.uint32)
                nib = sum(int((((ua >> np.uint32(4 * j)) & np.uint32(15)) != ((ub >> np.uint32(4 * j)) & np.uint32(15))).sum()) for j in range(8))
                worst.append((name, f"{nib / (ua.size * 8):.2e} nibbles differ"))
            else:
                f = (lambda x: np.frombuffer(x, np.float16).astype(np.float32)) if da == "float16" else (lambda x: (np.frombuffer(x, np.uint16).astype(np.uint32) << 16).view(np.float32))
                fa, fb = f(xa), f(xb)
                worst.append((name, f"max rel diff {float(np.max(np.abs(fa - fb) / (np.abs(fb) + 1e-12))):.2e}"))
    rep.update(tensors=len(b), same_shape_dtype=same_meta, byte_exact=exact, differing=sorted(worst)[:8])
    return rep


@app.function(image=image, cpu=4, memory=16384, timeout=3600, volumes={"/root/.cache/huggingface": hf_cache, "/out": vol})
def run(name: str, check: bool, quant: str = "q4f32_1") -> dict:
    import shutil

    from huggingface_hub import snapshot_download

    up = pathlib.Path(snapshot_download(UPSTREAM[quant]))
    report = {}
    if check:
        stock = pathlib.Path(snapshot_download(STOCK, allow_patterns=["*.json", "*.safetensors"]))
        convert(stock, pathlib.Path("/tmp/stock"), quant)
        report["stock_vs_upstream"] = compare(pathlib.Path("/tmp/stock"), up)
    out = pathlib.Path("/out") / name / OUT[quant]
    shutil.rmtree(out, ignore_errors=True)
    report["tuned_meta"] = convert(pathlib.Path("/out") / name / "merged", out, quant)
    report["tuned_vs_upstream_layout"] = {k: v for k, v in compare(out, up).items() if k != "differing"}
    # Same architecture and quantization as the prebuilt library: take its chat config and tokenizer files as they are.
    for f in up.iterdir():
        if f.is_file() and not f.name.startswith(("params_shard", "ndarray-cache", "tensor-cache")) and f.name not in ("README.md", ".gitattributes"):
            shutil.copy(f, out / f.name)
    report["out_files"] = sorted(f.name for f in out.iterdir() if not f.name.startswith("params_shard"))
    report["mb"] = round(sum(f.stat().st_size for f in out.iterdir()) / 1e6, 1)
    vol.commit()
    return report


@app.local_entrypoint()
def main(run_name: str = "llama32-1b-e3-r16", check: bool = False, quant: str = "q4f32_1"):
    print(json.dumps(run.remote(run_name, check, quant), indent=1, default=str))
