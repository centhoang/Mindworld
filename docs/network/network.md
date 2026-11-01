# Network

**Goal:** many players at once. Each peer gets only what is near it. Delay is acceptable; waste is not.

## Today
- All traffic goes through one room Durable Object, up to 24 peers. No peer-to-peer.
- `pos`, `pose`, `npcs`, `farm`, `emote`, `say`, `mind` all go `to: "others"`: every peer gets every message.
- So traffic grows with the square of players: 24 walkers at 10 Hz is ~5,500 messages a second out of one object.
- Messages are JSON. Positions are ~60 bytes.
- NPC minds run on an elected player's tab; only the room routes for them.

## AOI design
**Grid.** Split the world into cells of 16 x 16 tiles. A peer subscribes to the 3 x 3 cells around it. Grid over radius: cheap, easy to test, and it's the common choice (Photon).

**Hysteresis.** Enter a cell at its edge; leave only past an outer margin of 4 tiles, so walking along a border doesn't flicker (Photon's outer radius).

**Traffic by kind**
| Kind | Examples | Reach | Rate |
|---|---|---|---|
| Dynamic near | Player, pet, NPC position, pose | AOI cells | 5 Hz, send only on change |
| Events near | Bubble, emote, mind line, duel | AOI cells | On event |
| Static | Ground seed, farm plots, house | On entering a cell: snapshot | On change, to AOI only |
| Global | Join, leave, clock, NPC host | Everyone | Rare |
| Direct | Chat, ask, talk status | One peer | On event |

**On enter:** the server sends a snapshot of the cell. **On leave:** the client drops those entities.

**Messages.** Batch once per tick (200 ms) per peer. Drop stale positions: send only the newest per entity. Later, use short numeric ids and a binary form for positions.

**NPCs.** The host's tab sends positions at 2-5 Hz; the server filters by AOI. Far NPCs keep running on rules on their host.

## Structure
- `worker/src/aoi.ts`: pure grid: `move(id, x, z)` returns entered and left cells; `near(id)` returns peers. No Cloudflare, fully unit tested.
- `room.ts`: `to: "near"` joins `"others"` and `{id}` as an out target. Each message picks by the table above.
- `client/src/net/`: a transport with one interface, so a fake room can drive a lab.
- Metric: messages and bytes per peer per second, on a `/lab/net` readout.

## Capacity
Build for 100 peers in a room, then one world per room with new rooms when full. Sharding across Durable Objects only if a load test shows it's needed. Check Cloudflare's current Durable Object limits before quoting a number.

**Load test:** a headless script with N bot sockets walking. Report bytes per peer, and max tick time.

Compact world note: a small village means most players share cells there. AOI helps most on separate plots, and the tick batching helps in the crowd. Crowd rule: past ~16 entities in view, lower the far ones' rate.

Sources: [Photon MMO concept](https://doc.photonengine.com/server/v4/applications/mmo/mmo-concept), [Fusion interest area](https://doc.photonengine.com/fusion-godot/v3-client-server/manual/interest-area), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).
