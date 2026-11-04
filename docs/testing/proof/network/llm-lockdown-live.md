# `/api/llm` lock-down on live (P6, 2026-11-04, worker 950958dc)

Built by Codex from `.scratch/brief-llm-lockdown.md`, reviewed by Claude (diff, worker 288 and client 710 tests, both
typechecks clean). `worker/src/llm-policy.ts` (no imports) holds, per kind, the provider, the output cap, the prompt cap
and the system check; `handleLlm` uses it whatever the client sends and always asks for low effort.

| kind | provider (fixed) | max tokens | prompt cap | measured worst prompt | system check |
|---|---|---|---|---|---|
| memo (coach reflect) | meta (Muse Spark 1.3) | 4000 | 7900 | 5259 | exact coach text (1590 chars) |
| teach | baseten (Muse Spark Open) | 4000 | 6600 | 4360 | exact coach text |
| dialogue (cloud mind) | baseten | 400 | 4100 | 2688 | exact `SYSTEM` from `mind/brain.ts` |
| move (`?cloudmoves`) | modal (Muse Spark Open) | 600 | 140 | 90 | anchored regex, only the pet's name varies (1-12 letters/numbers, space, `_'-`) |
Measurements: `.scratch/measure-llm-lockdown.ts` (saturated memo, 4,500 simulated fights, all seven dialogue builders).
Finetune scripts (`build-sft.ts`, `gen-lessons.ts`, `gen-village.ts`) call Modal directly, so they are not affected.

## Live calls (`.scratch/p6/live-llm-proof.mts`, real prompts from the client's builders; $0.016 in all)
```
PASS coach reflect (memo): 200 provider=meta model=muse-spark-1.3 cost=0.00635 14429ms {"summary":"Guard heavy, attack turtle down, befriend scared foes.", ...
PASS teach: 200 provider=baseten model=meta-models/muse-spark-open-1026 cost=0.00530 5230ms {"summary":"Guard heavy hits, wait out bully's guard then strike hard, ...
PASS cloud villager line (dialogue): 200 provider=baseten (client sent provider=meta: ignored) cost=0.00195 1969ms   <- empty text, truncated: bug 61
PASS cloud move: 200 provider=modal model=meta-models/Muse-Spark-Open-816B-A42B cost=0.00264 2479ms emote: Hehe! Your guard won't help!
PASS REFUSE: system with text appended: 400 bad system
PASS REFUSE: free-form system: 400 bad system
PASS REFUSE: move prompt too long: 400 prompt too long
```
The dialogue call answered 200 on the right provider, but Muse Spark Open spent all 400 tokens reasoning (empty text,
`truncated: true`). Same as before the lock-down (same provider, effort and cap); logged as bug 61.

## Join check after the deploy
Run 1: 19/20 ("a late joiner sees who is talking": talker got nothing). Run 2: 19/20 ("after everyone leaves, the room
is empty": 2 left behind). A different single check each run; the lock-down touches no room code. Run 3: see below.
