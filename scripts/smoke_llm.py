"""Tiny smoke test for the two LLM endpoints. Costs well under $0.01. Never prints keys.

Run: python -I scripts/smoke_llm.py
"""
import json
import pathlib
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_env():
    env = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def post(url, key, body):
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, time.time() - t0, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, time.time() - t0, {"error": e.read().decode()[:300]}


def main():
    env = load_env()

    if env.get("META_API_KEY"):
        s, dt, j = post(
            "https://api.meta.ai/v1/responses",
            env["META_API_KEY"],
            {"model": env.get("META_MODEL", "muse-spark-1.3"), "input": "Reply with exactly: ok", "max_output_tokens": 200},
        )
        print(f"[meta] status={s} latency={dt:.2f}s usage={j.get('usage')} keys={list(j)[:8]}")
        print("[meta] text:", json.dumps(j)[:300] if s != 200 else str(j.get("output_text") or j.get("output"))[:200])

    if env.get("BASETEN_API_KEY"):
        s, dt, j = post(
            env.get("BASETEN_BASE_URL", "https://inference.baseten.co/v1") + "/chat/completions",
            env["BASETEN_API_KEY"],
            {"model": env.get("BASETEN_MODEL", "meta-models/muse-spark-open-1026"), "messages": [{"role": "user", "content": "Reply with exactly: ok"}], "max_tokens": 400},
        )
        msg = (j.get("choices") or [{}])[0].get("message", {}) if s == 200 else {}
        print(f"[baseten] status={s} latency={dt:.2f}s usage={j.get('usage')} message_keys={list(msg)}")
        print("[baseten] content:", str(msg.get("content"))[:200] if s == 200 else json.dumps(j)[:300])


if __name__ == "__main__":
    main()
