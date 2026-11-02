// Who sees whom: a grid of cells, each peer seeing the 3 x 3 around it, and a per-peer queue that keeps only the
// newest position of anything. Design: docs/network/network.md. Pure (no Workers APIs), tested directly.

export const CELL = 16; // tiles
export const MARGIN = 4; // tiles past a cell's edge before a peer counts as moved, so a border does not flicker
export const TICK_MS = 200;
export const CROWD = 16; // queued entities past this: far ones go out every other tick

interface At {
  cx: number;
  cz: number;
}

const cell = (v: number) => Math.floor(v / CELL);
const inView = (a: At, b: At) => Math.abs(a.cx - b.cx) <= 1 && Math.abs(a.cz - b.cz) <= 1;

export class Grid {
  private readonly at = new Map<string, At>();

  // Place or move a peer. `entered` and `left` are the peers it starts or stops seeing; `moved` = its cell changed.
  move(id: string, x: number, z: number): { entered: string[]; left: string[]; moved: boolean } {
    const was = this.at.get(id);
    const out = (v: number, c: number) => v < c * CELL - MARGIN || v >= (c + 1) * CELL + MARGIN;
    if (was && !out(x, was.cx) && !out(z, was.cz)) return { entered: [], left: [], moved: false };
    const now = { cx: cell(x), cz: cell(z) };
    this.at.set(id, now);
    const entered: string[] = [], left: string[] = [];
    for (const [o, there] of this.at) {
      if (o === id) continue;
      const seen = !!was && inView(was, there), sees = inView(now, there);
      if (sees && !seen) entered.push(o);
      if (seen && !sees) left.push(o);
    }
    return { entered, left, moved: true };
  }

  remove(id: string): void {
    this.at.delete(id);
  }

  sees(a: string, b: string): boolean {
    const [p, q] = [this.at.get(a), this.at.get(b)];
    return !!p && !!q && inView(p, q);
  }

  sameCell(a: string, b: string): boolean {
    const [p, q] = [this.at.get(a), this.at.get(b)];
    return !!p && !!q && p.cx === q.cx && p.cz === q.cz;
  }

  // Is this spot in view of the peer?
  covers(id: string, x: number, z: number): boolean {
    const p = this.at.get(id);
    return !!p && inView(p, { cx: cell(x), cz: cell(z) });
  }

  near(id: string): string[] {
    return [...this.at.keys()].filter((o) => o !== id && this.sees(id, o));
  }
}

// What waits for the next tick, per peer: one message per key, the newest.
export class Batcher<M> {
  private readonly queues = new Map<string, Map<string, M>>();

  add(peer: string, key: string, msg: M): void {
    const q = this.queues.get(peer) ?? new Map<string, M>();
    q.set(key, msg);
    this.queues.set(peer, q);
  }

  get pending(): boolean {
    return this.queues.size > 0;
  }

  drop(peer: string): void {
    this.queues.delete(peer);
  }

  // One tick's messages. In a crowd, what `far` names waits for the even ticks, still only its newest.
  take(tick: number, far: (peer: string, key: string) => boolean): Map<string, M[]> {
    const out = new Map<string, M[]>();
    for (const [peer, q] of this.queues) {
      const slow = q.size > CROWD && tick % 2 === 1;
      const go = [...q].filter(([k]) => !slow || !far(peer, k));
      for (const [k] of go) q.delete(k);
      if (!q.size) this.queues.delete(peer);
      if (go.length) out.set(peer, go.map(([, m]) => m));
    }
    return out;
  }
}
