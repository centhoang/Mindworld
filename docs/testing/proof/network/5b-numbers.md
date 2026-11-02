# Network numbers on the deployed room, 2026-11-02

Build 15ccb181. `node scripts/net-bots.mjs <bots> <s> <mode>`, all bots from one home machine, each walking at 5 Hz.

| Bots asked | Held | Mode | Median B/s per bot | Msg/s per bot | Batch gap p50 / p95 ms |
|---|---|---|---|---|---|
| 10 | 10 | spread | 353 | 4.2 | 204 / 521 |
| 50 | 47 | spread | 292 | 3.5 | 210 / 621 |
| 100 | 84 | spread | 278 | 3.3 | 211 / 618 |
| 25 | 24 | one crowd | 5,541 | 5.1 | 203 / 219 |
| 100 | 89 | one crowd | 19,750 | 4.8 | 207 / 251 |

- Traffic per bot stays flat as far players are added. Before AOI, 100 walkers at 5 Hz would be ~30,000 B/s each.
- Worst case, all in one view: ~20 KB/s down per player.
- Some bots failed to connect. None closed with a room error. A plain handshake probe gave 39 of 40 `101` and one local `ETIMEDOUT`, so the loss is this machine's link. **100 was asked for and 89 held: 100 itself is not proven.**
- Max batch gap on this link: 5 s, once. Not traced; p95 is fine.

`node scripts/net-check.mjs`, 7 clean runs in a row on the live room:
- far newcomer out of view; walking in gives one enter; positions follow in the tick batch
- farm and emote reach someone near; a far player gets no positions, emotes or chat
- walking away gives one exit; coming back gives an enter with the farm
- a real leave reaches everyone; a reconnect joins once

Real client, `/lab/net` with a bot walking in and out: players seen 1, 2, 1, with 2 in the room throughout.

Found by the load test and fixed: a socket that died without a close held a place forever. The room now closes both sides and removes peers silent for 90 s.
