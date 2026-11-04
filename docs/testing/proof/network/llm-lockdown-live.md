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
is empty": 2 left behind). A different single check each run; the lock-down touches no room code.
Runs 3 (18/20) and 4 (15/19) started within a minute or two of the previous run and found its leftovers still in
("starts empty: 2 / 3 already in"), which also broke "everyone sees everyone" and the kick burst. A probe a minute
after run 4: 0 in the room. **Run 5 from an empty room: 19/20**, only "after everyone leaves, the room is empty (1 left
behind: Big2)"; a probe 100 s later: 0. So a close lost on this home link in the 100-socket burst leaves a ghost until
the room's reaper (`SILENT_MS` 90 s, `room-do.ts`) drops it. The room is fine; the check's settle window is shorter
than the reaper. Rule added to `ops/tooling.md`: wait 2 minutes between runs.

## The move to mindworld.uryto.dev (worker 0b90b603, 2026-11-04 ~21:20 VN)
Access app "pets" lists pets.uryto.dev and mindworld.uryto.dev (policy "Owner home only"; read in the TEMP profile).
From home: `https://mindworld.uryto.dev/` 200 with `main-czFxq799`, `/api/spend` 200, pets.uryto.dev still 200.
Join check on the new host from an empty room (probe 0): **16/19**. Misses: "who is talking" (welcome talks 0 though
the talk started: bug 62), "100 held" (99 in 27 s, retries 9: the home link), "room empty" (2 left behind: Bot8, Big45;
a probe 100 s later: 0). **Outside check (user, 2026-11-04 ~21:40 VN): a phone on mobile data gets "Forbidden" (Access
blocks it); the same phone on home Wi-Fi opens the game.**
