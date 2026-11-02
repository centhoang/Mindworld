import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { Batcher, TICK_MS } from "./aoi";
import { Room, ROOM_MAX_MSG_BYTES, type Out, type Peer, type ServerMsg } from "./room";

// One Durable Object per world (idFromName("main")) holding the live sockets. It uses the WebSocket
// Hibernation API, so an idle room costs no duration: peer state lives in each socket's attachment and
// is restored when the object wakes. Keepalive "ping" is answered by the runtime without waking it.

const SILENT_MS = 90_000;
const REAP_TICKS = 100;

interface Attachment {
  id: string;
  peer?: Peer; // set after the socket's hello
}

export class WorldRoom extends DurableObject<Env> {
  private readonly room = new Room();
  private readonly batch = new Batcher<ServerMsg>();
  private tick = 0;
  private armed = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    for (const ws of ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.peer) this.room.restore(a.peer);
    }
    void ctx.blockConcurrencyWhile(async () => {
      this.room.restoreAways(await ctx.storage.get("aways"));
      this.room.board.restore(await ctx.storage.get("npcLogs"));
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8) } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    const a = ws.deserializeAttachment() as Attachment;
    const now = Date.now();
    if (!a.peer) {
      // The first message must be a hello; anything else closes the socket.
      let hello: Record<string, unknown> | null = null;
      try {
        hello = typeof data === "string" && data.length <= ROOM_MAX_MSG_BYTES ? (JSON.parse(data) as Record<string, unknown>) : null;
      } catch {
        /* not JSON */
      }
      if (!hello || hello.t !== "hello") return ws.close(1008, "hello first");
      this.reap(now);
      const joined = this.room.join(a.id, hello, now);
      if (!joined) {
        ws.send(JSON.stringify({ t: "full" }));
        return ws.close(1013, "room full");
      }
      ws.serializeAttachment({ id: a.id, peer: joined.peer } satisfies Attachment);
      this.deliver(ws, joined.out);
      return this.persistAways();
    }
    const r = this.room.message(a.id, data, now);
    if (r.changed) {
      const peer = this.room.peers.get(a.id);
      if (peer) ws.serializeAttachment({ id: a.id, peer } satisfies Attachment);
    }
    this.deliver(ws, r.out);
    if (r.close) {
      this.deliver(ws, this.room.leave(a.id));
      ws.close(1008, r.close);
    }
    this.persistDirty();
  }

  async webSocketClose(ws: WebSocket) {
    this.drop(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.drop(ws);
  }

  private drop(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (a) {
      this.batch.drop(a.id);
      this.deliver(ws, this.room.leave(a.id));
      ws.serializeAttachment({ id: a.id } satisfies Attachment); // no peer: a wake-up must not bring it back
    }
    try {
      ws.close(1000); // the runtime keeps a socket until this side closes it too
    } catch {
      /* already closed */
    }
    this.persistDirty();
  }

  // A socket can die with no close ever arriving, and it would hold a place for good. Clients ping every 30 s.
  private reap(now: number) {
    const all = this.sockets();
    for (const [id, peer] of [...this.room.peers]) {
      const ws = all.get(id);
      const pinged = ws ? this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0 : 0;
      if (ws && now - Math.max(peer.at, pinged) < SILENT_MS) continue;
      this.batch.drop(id);
      if (ws) this.drop(ws);
      else this.deliverAll(this.room.leave(id));
    }
  }

  // What a peer with no socket leaves behind still reaches everyone else.
  private deliverAll(out: Out[]) {
    const all = this.sockets();
    for (const o of out) {
      const text = JSON.stringify(o.msg);
      const targets = o.to === "others" ? [...all.keys()] : typeof o.to === "object" ? [o.to.id] : [];
      for (const id of targets) {
        const ws = all.get(id);
        if (ws) safeSend(ws, text);
      }
    }
  }

  // Ghost grounds outlive the sockets, so they go to storage (tiny: <= 24 entries).
  private persistAways() {
    if (this.room.board.changed) {
      this.room.board.changed = false;
      void this.ctx.storage.put("npcLogs", this.room.board.snapshot());
    }
    if (!this.room.awaysChanged) return;
    this.room.awaysChanged = false;
    void this.ctx.storage.put("aways", this.room.aways);
  }

  // Peers changed by someone else's message (a challenge answered or dropped) get their attachment rewritten.
  private persistDirty() {
    this.persistAways();
    const ids = new Set(this.room.takeDirty());
    if (!ids.size) return;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      const peer = a && ids.has(a.id) ? this.room.peers.get(a.id) : undefined;
      if (a && peer) ws.serializeAttachment({ id: a.id, peer } satisfies Attachment);
    }
  }

  private sockets(): Map<string, WebSocket> {
    const all = new Map<string, WebSocket>();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.peer) all.set(a.id, ws);
    }
    return all;
  }

  private deliver(from: WebSocket, out: Out[]) {
    if (!out.length) return;
    const me = (from.deserializeAttachment() as Attachment | null)?.id ?? "";
    const all = this.sockets();
    for (const o of out) {
      const targets = o.to === "self" ? [me] : o.to === "near" ? this.room.near(me) : o.to === "others" ? [...all.keys()].filter((id) => id !== me) : [o.to.id];
      if (o.key) {
        for (const id of targets) this.batch.add(id, o.key, o.msg);
        continue;
      }
      const text = JSON.stringify(o.msg);
      for (const id of targets) {
        const ws = id === me ? from : all.get(id);
        if (ws) safeSend(ws, text);
      }
    }
    this.arm();
  }

  private arm() {
    if (this.armed || !this.batch.pending) return;
    this.armed = true;
    setTimeout(() => this.flush(), TICK_MS);
  }

  // One tick: a socket's waiting messages travel together.
  private flush() {
    this.armed = false;
    if (this.tick % REAP_TICKS === 0) this.reap(Date.now());
    const all = this.sockets();
    for (const [id, msgs] of this.batch.take(this.tick++, (peer, key) => this.room.far(peer, key))) {
      const ws = all.get(id);
      if (ws) safeSend(ws, JSON.stringify({ t: "b", m: msgs }));
    }
    this.arm();
  }
}

function safeSend(ws: WebSocket, text: string) {
  try {
    ws.send(text);
  } catch {
    /* socket already closing */
  }
}
