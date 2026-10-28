import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { Room, ROOM_MAX_MSG_BYTES, type Out, type Peer } from "./room";

// One Durable Object per world (idFromName("main")) holding the live sockets. It uses the WebSocket
// Hibernation API, so an idle room costs no duration: peer state lives in each socket's attachment and
// is restored when the object wakes. Keepalive "ping" is answered by the runtime without waking it.

interface Attachment {
  id: string;
  peer?: Peer; // set after the socket's hello
}

export class WorldRoom extends DurableObject<Env> {
  private readonly room = new Room();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    for (const ws of ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.peer) this.room.restore(a.peer);
    }
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
      const joined = this.room.join(a.id, hello, now);
      if (!joined) {
        ws.send(JSON.stringify({ t: "full" }));
        return ws.close(1013, "room full");
      }
      ws.serializeAttachment({ id: a.id, peer: joined.peer } satisfies Attachment);
      return this.deliver(ws, joined.out);
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
  }

  async webSocketClose(ws: WebSocket) {
    this.drop(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.drop(ws);
  }

  private drop(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (a) this.deliver(ws, this.room.leave(a.id));
  }

  private deliver(from: WebSocket, out: Out[]) {
    for (const o of out) {
      const text = JSON.stringify(o.msg);
      if (o.to === "self") {
        safeSend(from, text);
        continue;
      }
      for (const ws of this.ctx.getWebSockets()) {
        if (ws !== from && (ws.deserializeAttachment() as Attachment | null)?.peer) safeSend(ws, text);
      }
    }
  }
}

function safeSend(ws: WebSocket, text: string) {
  try {
    ws.send(text);
  } catch {
    /* socket already closing */
  }
}
