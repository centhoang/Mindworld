// The Sunnyside look, drawn from the Overworld's state. It stays as the fallback until the glyph view replaces it.
import type { BubbleFate, Scene, View } from "../game/ports";
import { needsWater } from "../game/farm";
import { ACTIVITY } from "../life/activities";
import { gameTime } from "../life/clock";
import type { Agent } from "../life/village";
import type { Vec } from "../world/movement";
import { NPCS, type Npc } from "../world/live";
import { AWAY, hash2, lookAt, T, TILE } from "../world/tilemap";
import { hasArt, img, PAL, spriteFrame } from "./art";
import { layoutBubbles, type BubbleBox, type Placed } from "./bubbles";
import { generatedSprites } from "./generated-sprites";
import { drawDecor, drawSpotProp } from "./grounds-draw";
import { humanSprites, newHumanMotion, NPC_LOOKS } from "./humans";
import { drawInspector } from "./inspector";
import { drawBall, drawBowl, drawPetPose, drawPoop, drawTint, sitFrame } from "./life-draw";
import { bedsAt, CHIMNEY, CROP_ART, CROP_STAGE, HOME_ART, OVERWORLD_MON, type Overworld } from "./overworld";
import { characterShadow, drawCropArt, drawHighClouds, drawLand, drawRail, drawSea, drawSeaLife, drawTree, footRuns, stampSize, stand, standRun, strip } from "./sunny";
import { tile } from "./sunny-terrain";
import { drawFrame, drawText, drawTinyText, GLYPH, wrap } from "./text";

const SMOKE_W = 15;
const SMOKE_H = 37;

export class PixelView implements View {
  constructor(private readonly o: Overworld) {}

  // A house with its chimney smoke. Each stretch of wall sorts on its own foot (docs/visual/layers.md).
  private pushHouse(items: { z: number; draw: () => void }[], g: CanvasRenderingContext2D, art: string, z: number, x: number, y: number, t: number): void {
    for (const r of footRuns(art)) items.push({ z: z - r.foot / TILE, draw: () => standRun(g, art, r, x, y) });
    const top = CHIMNEY[art];
    if (!top) return;
    const [w, h] = stampSize(art);
    items.push({ z, draw: () => strip(g, "chimneysmoke_01_strip30", x - w / 2 + top[0] - SMOKE_W / 2, y - h + top[1] - SMOKE_H + 3, Math.floor(t * 10)) });
  }

  // A small name over every person, players and villagers alike.
  private drawNames(g: CanvasRenderingContext2D, toScreen: (x: number, z: number) => [number, number], sw: number, sh: number): void {
    const o = this.o;
    const tag = (name: string, pos: Vec) => {
      const [x, y] = toScreen(pos.x, pos.z);
      if (x < -30 || y < 0 || x > sw + 30 || y > sh + 30) return;
      drawTinyText(g, name, Math.round(x), y - 28);
    };
    tag(o.myName, o.player);
    for (const p of o.peers.values()) tag(p.name, p.pos);
    for (const a of o.npcs?.v.agents ?? []) tag(a.name, a.pos);
  }

  // Top-right map of the islands: land, paths and bridges, my ground, other players and me.
  private drawMinimap(g: CanvasRenderingContext2D, sw: number): void {
    const o = this.o;
    const m = o.map;
    if (!o.mini) {
      const c = document.createElement("canvas");
      [c.width, c.height] = [m.w, m.h];
      const cg = c.getContext("2d")!;
      const away = (k: number) => (m.look[k]! & AWAY) !== 0;
      for (let k = 0; k < m.w * m.h; k++) {
        const t = m.kind[k]!;
        if (t === T.water) continue;
        cg.fillStyle = t === T.path || t === T.bridge ? PAL.sand : away(k) ? PAL.stone : PAL.grass;
        cg.fillRect(k % m.w, Math.floor(k / m.w), 1, 1);
      }
      o.mini = c;
    }
    const size = 52;
    const k = size / Math.max(m.w, m.h);
    const x0 = sw - size - 6;
    const y0 = 18;
    g.fillStyle = PAL.waterD;
    g.fillRect(x0 - 2, y0 - 2, size + 4, size + 4);
    g.imageSmoothingEnabled = true;
    g.drawImage(o.mini, x0 + (size - m.w * k) / 2, y0 + (size - m.h * k) / 2, m.w * k, m.h * k);
    g.imageSmoothingEnabled = false;
    const dot = (x: number, z: number, c: string, r = 2) => {
      g.fillStyle = c;
      g.fillRect(Math.round(x0 + (size - m.w * k) / 2 + (x - m.ox) * k - r / 2), Math.round(y0 + (size - m.h * k) / 2 + (z - m.oz) * k - r / 2), r, r);
    };
    dot(o.house.x, o.house.z + 2, PAL.woodD, 4);
    for (const p of o.peers.values()) dot(p.pos.x, p.pos.z, PAL.teal, 3);
    dot(o.player.x, o.player.z, PAL.coral, 3);
  }

  private drawBeds(g: CanvasRenderingContext2D, toScreen: (x: number, z: number) => [number, number], t: number): void {
    const o = this.o;
    for (const p of o.world.platforms) {
      if (!p.ground || p.owner === "me") continue;
      const farm = o.peerFarms.get(p.owner ?? "");
      bedsAt(p).forEach((b, i) => {
        const [sx, sy] = toScreen(b.x, b.z);
        stand(g, "soil", sx + 8, sy + 14);
        const [crop, stage] = farm?.[i] ?? ["", 0];
        if (crop) drawCropArt(g, CROP_ART[crop] ?? "carrot", CROP_STAGE[Math.min(3, stage)]!, sx + 8, sy + 13);
      });
    }
    o.beds.forEach((b, i) => {
      const [sx, sy] = toScreen(b.x, b.z);
      const p = o.farm?.plots[i];
      stand(g, "soil", sx + 8, sy + 14);
      if (p?.crop) drawCropArt(g, CROP_ART[p.crop] ?? "carrot", CROP_STAGE[Math.min(3, p.stage)]!, sx + 8, sy + 13);
      if (p && p.wetUntil) {
        g.fillStyle = PAL.teal; // wet soil: teal corner marker (STYLE.md farms)
        g.fillRect(sx + 3, sy + 11, 2, 2);
        g.fillRect(sx + 11, sy + 11, 2, 2);
      } else if (p && needsWater(p) && Math.floor(t * 2) % 2) {
        g.fillStyle = PAL.waterL;
        g.fillRect(sx + 7, sy - 4, 2, 3);
        g.fillRect(sx + 6, sy - 2, 4, 2);
      }
    });
  }

  draw(scene: Scene, g: CanvasRenderingContext2D, sw: number, sh: number, t: number): BubbleFate[] {
    const o = this.o;
    const m = scene.map;
    const camX = Math.round(scene.cam.x * TILE - sw / 2);
    const camY = Math.round(scene.cam.z * TILE - sh / 2);
    const toScreen = (x: number, z: number): [number, number] => [Math.round(x * TILE) - camX, Math.round(z * TILE) - camY];
    drawSea(g, m, camX, camY, sw, sh, t);
    drawLand(g, m, o.sunny, camX, camY, sw, sh, t);
    drawSeaLife(g, o.sunny.seaLife, camX, camY, sw, sh, t);
    this.drawBeds(g, toScreen, t);
    const plaza = o.world.platforms.find((p) => p.kind === "plaza");
    // Sprites sorted by their feet, so things lower on screen stand in front.
    const items: { z: number; draw: () => void }[] = [];
    if (o.noticeBoard) {
      const board = o.noticeBoard;
      const [sx, sy] = toScreen(board.x, board.z);
      items.push({ z: board.z, draw: () => generatedSprites.draw(g, "notice-board-notes", sx, sy, () => {
        g.fillStyle = PAL.woodD;
        g.fillRect(sx - 10, sy - 18, 2, 18);
        g.fillRect(sx + 8, sy - 18, 2, 18);
        g.fillStyle = PAL.wood;
        g.fillRect(sx - 13, sy - 29, 26, 23);
        g.fillStyle = PAL.cream;
        g.fillRect(sx - 9, sy - 25, 7, 10);
        g.fillRect(sx + 2, sy - 23, 7, 11);
      }) });
    }
    const today = gameTime(o.life.t).day;
    // Due promises remain open. The room shares promise memory only with that NPC's host.
    const birthday = NPCS.some((id) => (o.npcs?.hub.minds.get(id)?.mem.promises ?? [])
      .some((p) => p.state === "open" && p.day === today && /birthday/i.test(p.occasion)));
    if (plaza && birthday) {
      // Decorations sit just outside the dance floor; they do not obstruct the plaza routes.
      const [bx, by] = toScreen(plaza.x, plaza.z - 2.5);
      items.push({ z: plaza.z - 2.5, draw: () => generatedSprites.draw(g, "birthday-bunting", bx, by - 18) });
      const balloons = ["birthday-balloon-red", "birthday-balloon-blue", "birthday-balloon-gold"] as const;
      balloons.forEach((name, i) => {
        const z = plaza.z + (i === 2 ? 1.5 : -1.5);
        const [sx, sy] = toScreen(plaza.x + (i === 0 ? -3.5 : 3.5), z);
        items.push({ z, draw: () => generatedSprites.draw(g, name, sx, sy) });
      });
    }
    {
      const rail = o.sunny.rail;
      const [i0, j0] = [Math.floor(camX / TILE) - m.ox, Math.floor(camY / TILE) - m.oz];
      for (let j = Math.max(0, j0); j <= Math.min(m.h - 1, j0 + Math.ceil(sh / TILE) + 1); j++)
        for (let i = Math.max(0, i0); i <= Math.min(m.w - 1, i0 + Math.ceil(sw / TILE) + 1); i++) {
          const cell = rail[j * m.w + i];
          if (!cell) continue;
          const [x, y] = [(i + m.ox) * TILE - camX, (j + m.oz) * TILE - camY];
          items.push({ z: m.oz + j + 0.5, draw: () => drawRail(g, cell, x, y) });
        }
    }
    for (const tr of o.trees) {
      const [sx, sy] = toScreen(tr.x, tr.z);
      if (sx < -32 || sy < -48 || sx > sw + 32 || sy > sh + 48) continue;
      const seed = Math.floor(hash2(Math.floor(tr.x), Math.floor(tr.z), 12) * 1000);
      items.push({ z: tr.z, draw: () => drawTree(g, seed, sx, sy + 4, t, 0) });
    }
    const lit = gameTime(o.life.t).phase;
    for (const d of o.decor) {
      const [sx, sy] = toScreen(d.x, d.z);
      if (sx < -40 || sy < -40 || sx > sw + 40 || sy > sh + 40) continue;
      if (d.kind === "fence-v") {
        // One item per tile, so people passing along it sort with each post (docs/visual/layers.md).
        d.tiles.forEach((k, n) => {
          const [ti, tj] = [m.ox + (k % m.w), m.oz + Math.floor(k / m.w)];
          const [fx, fy] = toScreen(ti, tj);
          const part = n === 0 ? tile(1, 40) : n === d.tiles.length - 1 ? tile(4, 40) : tile(3, 40);
          items.push({ z: tj + 0.5, draw: () => drawRail(g, part, fx, fy) });
        });
        continue;
      }
      const look = lookAt(m, Math.floor(d.x), Math.floor(d.z));
      items.push({ z: d.z - (d.kind === "lights" ? 0.2 : 0), draw: () => drawDecor(g, d.kind, sx, sy + 8, Math.max(1, d.tiles.length), look, lit === "evening" || lit === "night") });
    }
    {
      const [hx, hy] = toScreen(o.house.x, o.house.z);
      if (!scene.indoors) this.pushHouse(items, g, HOME_ART, o.house.z, hx, hy, t);
    }
    for (const h of o.houses) {
      const [hx, hy] = toScreen(h.x, h.z);
      if (hx < -64 || hy < -16 || hx > sw + 64 || hy > sh + 110) continue;
      this.pushHouse(items, g, h.art, h.z, hx, hy, t);
    }
    for (const l of o.landmarks) {
      const [lx, ly] = toScreen(l.x, l.z);
      if (lx < -60 || ly < -16 || lx > sw + 60 || ly > sh + 100) continue;
      items.push({ z: l.z, draw: () => stand(g, l.art, lx, ly) });
    }
    for (const c of o.critters) {
      const [cx, cy] = toScreen(c.x, c.z);
      if (cx < -40 || cy < -40 || cx > sw + 40 || cy > sh + 40) continue;
      items.push({ z: c.z, draw: () => strip(g, c.art, cx - 16, cy - 24, Math.floor(t * 3 + c.seed), c.seed % 2 === 1) });
    }
    for (const p of o.world.platforms) {
      if (!p.spots) continue;
      for (const [name, at] of Object.entries(p.spots)) {
        const [sx, sy] = toScreen(at.x, at.z);
        if (sx < -48 || sy < -48 || sx > sw + 48 || sy > sh + 48) continue;
        items.push({ z: at.z - (name === "blanket" || name === "dock" ? 9 : 0), draw: () => drawSpotProp(g, name, sx, sy, t) });
      }
    }
    const [px, py] = toScreen(o.player.x, o.player.z);
    const pf = spriteFrame(o.playerSprite, o.moving, o.playerMotion.walkTime, t);
    if (!scene.indoors) items.push({ z: o.player.z, draw: () => (characterShadow(g, px, py), humanSprites.draw(g, o.myLook, o.playerMotion, px, py, t,
      () => g.drawImage(o.playerSprite.img, pf * 16, o.playerMotion.dir * 24, 16, 24, px - 8, py - 22, 16, 24))) });
    const half = OVERWORLD_MON / 2;
    for (const p of o.peers.values()) {
      const [ax, ay] = toScreen(p.pos.x, p.pos.z);
      const [bx, by] = toScreen(p.pet.x, p.pet.z);
      items.push({ z: p.pos.z, draw: () => {
        characterShadow(g, ax, ay);
        humanSprites.draw(g, p.look, p.motion, ax, ay, t,
          () => g.drawImage(o.playerSprite.img, spriteFrame(o.playerSprite, p.motion.walking, p.motion.walkTime, t) * 16, p.motion.dir * 24, 16, 24, ax - 8, ay - 22, 16, 24));
      } });
      items.push({ z: p.pet.z, draw: () => g.drawImage(p.sprite, bx - half, by - OVERWORLD_MON + 2) });
    }
    if (o.stall) {
      const [mx, my] = toScreen(o.stall.x, o.stall.z);
      items.push({ z: o.stall.z, draw: () => stand(g, "stall-red", mx, my + 4) });
    }
    if (o.elder && !o.npcs?.v.agents.some(a => a.id === "elder")) {
      // The Elder also uses the shared human path before the NPC sim is attached.
      const [nx, ny] = toScreen(o.elder.pos.x, o.elder.pos.z);
      items.push({ z: o.elder.pos.z, draw: () => humanSprites.draw(g, NPC_LOOKS.elder, newHumanMotion(o.elder!.pos), nx, ny, t, () => {
        if (hasArt("elder-npc")) g.drawImage(img("elder-npc"), (Math.floor(t * 2) % 2) * 16, 0, 16, 24, nx - 8, ny - 22, 16, 24);
        else g.drawImage(o.elder!.sprite, nx - 12, ny - 22);
      }) });
    }
    for (const npc of [o.boss, o.ghostStone]) {
      if (!npc) continue;
      const [nx, ny] = toScreen(npc.pos.x, npc.pos.z);
      const s = npc.sprite;
      items.push({ z: npc.pos.z, draw: () => g.drawImage(s, nx - s.width / 2, ny - s.height + 2 - (Math.floor(t * 1.5) % 2)) });
    }
    const [qx, qy] = toScreen(o.pet.x, o.pet.z);
    const hop = Math.floor(t * 4) % 2;
    if (!scene.indoors) items.push({ z: o.pet.z, draw: () => g.drawImage(o.petSprite, qx - half, qy - OVERWORLD_MON + 2 - hop) });
    for (const [id, pos] of o.npcPets) {
      if (!o.npcs?.hasPet[id]) continue;
      const [nx, ny] = toScreen(pos.x, pos.z);
      if (nx < -24 || ny < -24 || nx > sw + 24 || ny > sh + 24) continue;
      items.push({ z: pos.z, draw: () => {
        const image = o.npcPetImages.get("/art/gen/wild/forest-sprig-16-front-idle.png");
        if (image) g.drawImage(image, nx - 8, ny - 14 - hop);
      } });
    }
    for (const w of o.wilds) {
      const [wx, wy] = toScreen(w.pos.x, w.pos.z);
      if (wx < -24 || wy < -24 || wx > sw + 24 || wy > sh + 24) continue;
      const wh = w.wait <= 0 ? Math.floor(t * 5 + w.id) % 2 : 0;
      items.push({ z: w.pos.z, draw: () => g.drawImage(w.sprite, wx - half, wy - OVERWORLD_MON + 2 - wh) });
    }
    {
      const [bx, by] = toScreen(o.bowl.x, o.bowl.z);
      items.push({ z: o.bowl.z, draw: () => drawBowl(g, bx, by) });
    }
    for (const m of o.life.messes) {
      const [mx, my] = toScreen(m.pos.x, m.pos.z);
      items.push({ z: m.pos.z - 0.3, draw: () => drawPoop(g, mx, my, t, m.id) });
    }
    o.residents.forEach((r, k) => {
      const a = r.agent;
      const [rx, ry] = toScreen(a.pos.x, a.pos.z);
      if (rx < -24 || ry < -40 || rx > sw + 24 || ry > sh + 24) return;
      const pose = a.state === "do" ? ACTIVITY.get(a.act!)!.pose : null;
      items.push({ z: a.pos.z, draw: () => drawPetPose(g, r.sprite, rx, ry, pose, a.state === "walk", t, k) });
    });
    // Every villager, including the Elder, follows the same human drawing path as online players.
    for (const a of o.npcs?.v.agents ?? []) {
      const [nx, ny] = toScreen(a.pos.x, a.pos.z);
      if (nx < -24 || ny < -40 || nx > sw + 24 || ny > sh + 24) continue;
      const s = o.npcSprite(a.id as Npc);
      const motion = o.npcMotions.get(a.id as Npc) ?? newHumanMotion(a.pos);
      const { walking, dir } = motion;
      const sit = a.state === "do" && (ACTIVITY.get(a.act!)!.pose === "sit" || ACTIVITY.get(a.act!)!.pose === "sleep");
      const f = spriteFrame(s, walking, motion.walkTime, t);
      const frame = sit ? sitFrame(s.img, (s.idle ?? 0) * 16, dir * 24, dir === 3) : null; // seated: still, legs bent
      if (motion.pose === "sleep" && !walking) {
        items.push({ z: a.pos.z, draw: () => {
          stand(g, "f-bed", nx, ny + 3);
          humanSprites.drawAsleep(g, NPC_LOOKS[a.id as Npc], nx, ny);
          drawTinyText(g, "z".repeat(1 + Math.floor(t) % 3), nx + 9, ny - 24);
        } });
        continue;
      }
      items.push({ z: a.pos.z, draw: () => (characterShadow(g, nx, ny), humanSprites.draw(g, NPC_LOOKS[a.id as Npc], motion, nx, ny, t, () => {
        if (a.id === "elder" && hasArt("elder-npc")) g.drawImage(img("elder-npc"), (Math.floor(t * 2) % 2) * 16, 0, 16, 24, nx - 8, ny - 22, 16, 24);
        else if (frame) g.drawImage(frame, nx - 8, ny - 22);
        else g.drawImage(s.img, f * 16, dir * 24, 16, 24, nx - 8, ny - 22, 16, 24);
      })) });
    }
    for (const sg of o.signs) {
      const [sx, sy] = toScreen(sg.x, sg.z);
      if (sx < -48 || sy < -48 || sx > sw + 48 || sy > sh + 48) continue;
      const near = Math.hypot(sg.x - o.player.x, sg.z - o.player.z) < 7;
      items.push({ z: sg.z, draw: () => {
        drawSpotProp(g, "sign", sx, sy + 4, t);
        if (near) drawTinyText(g, sg.text, Math.round(sx), sy - 16);
      } });
    }
    // A picnic away from a picnic hill (the NPCs on the plaza) spreads its own blanket.
    for (const gt of [...o.life.gatherings, ...(o.npcs?.v.gatherings ?? [])]) {
      if (gt.act !== "picnic" || !gt.started) continue;
      if (o.world.platforms.some((p) => p.spots?.blanket && Math.hypot(p.spots.blanket.x - gt.at.x, p.spots.blanket.z - gt.at.z) < 4)) continue;
      const ps = [...o.life.agents, ...(o.npcs?.v.agents ?? [])].filter((a) => gt.members.includes(a.id) && a.gather === gt.id);
      if (!ps.length) continue;
      const cx = ps.reduce((sum, a) => sum + a.pos.x, 0) / ps.length; // under the group, wherever they sat down
      const cz = ps.reduce((sum, a) => sum + a.pos.z, 0) / ps.length;
      const [bx, by] = toScreen(cx, cz + 0.7);
      items.push({ z: cz - 9, draw: () => drawSpotProp(g, "blanket", bx, by, t) });
    }
    // A ball bounces between pets playing together.
    for (const gt of o.life.gatherings) {
      if (gt.act !== "ball" || !gt.started) continue;
      const ps = gt.members.map((id) => o.life.agents.find((a) => a.id === id)).filter((a): a is Agent => !!a && a.state === "do");
      if (ps.length < 2) continue;
      const ph = (t * 0.8 + gt.id) % 2;
      const u = ph < 1 ? ph : 2 - ph;
      const [a, b] = [ps[0]!.pos, ps[1]!.pos];
      const [x, y] = toScreen(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u);
      items.push({ z: a.z + (b.z - a.z) * u, draw: () => drawBall(g, x, y - Math.round(Math.sin(u * Math.PI) * 8)) });
    }
    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.draw();
    drawHighClouds(g, camX, camY, sw, sh, t);
    const now = scene.clock;
    if (!scene.day) drawTint(g, now.hour, sw, sh);
    {
      const label = now.label;
      drawText(g, label, sw - label.length * GLYPH - 6, 6, PAL.panel);
    }
    if (scene.showMap) this.drawMinimap(g, sw);
    if (scene.showNames) this.drawNames(g, toScreen, sw, sh);

    o.underBubbles?.();
    const shown: { id: string; head: string; lines: string[]; thought: boolean; cx: number; y: number; box: BubbleBox }[] = [];
    for (const b of scene.bubbles) {
      const [bx, by] = toScreen(b.x, b.z);
      if (bx < -10 || by < -10 || bx > sw + 10 || by > sh + 40) continue; // someone out of sight stays out of sight
      const lines = wrap(b.text, Math.min(180, sw - 24));
      const w = Math.max(b.head.length, ...lines.map((l) => l.length)) * GLYPH + 12;
      const bottom = by - OVERWORLD_MON - 12;
      shown.push({ id: b.id, head: b.head, lines, thought: b.thought, cx: bx, y: bottom, box: { cx: bx, bottom, w, h: (lines.length + (b.head ? 1 : 0)) * 10 + 8, first: b.first } });
    }
    const spots = layoutBubbles(shown.map((s) => s.box), sw, sh);
    const fates: BubbleFate[] = shown.map((s, i) => {
      const spot = spots[i];
      if (spot) bubble(g, s.head, s.lines, s.cx, s.box.w, s.box.h, spot, s.thought);
      else stand(g, "expression_chat", s.cx, s.y + 12); // their line waits its turn
      return [s.id, !spot];
    });
    const hint = scene.hint;
    if (hint) {
      const w = hint.length * GLYPH + 12;
      drawFrame(g, Math.round(px - w / 2), py + 6, w, 16);
      drawText(g, hint, Math.round(px - w / 2) + 6, py + 10, PAL.wood);
    }
    const ins = scene.inspector;
    if (ins) drawInspector(g, ins.mind, ins.agent, ins.rel, ins.nameOf, ins.where, sw, sh);
    if (scene.banner) {
      const { text, left } = scene.banner;
      const w = text.length * GLYPH + 16;
      const x = Math.floor((sw - w) / 2);
      const y = left > 2.2 ? -16 + Math.round((2.5 - left) * 70) : left < 0.3 ? 5 - Math.round((0.3 - left) * 70) : 5;
      drawFrame(g, x, y, w, 17);
      drawText(g, text, x + 8, y + 5, PAL.wood);
    }
    return fates;
  }
}

// A speech bubble above a sprite: up to 3 wrapped lines, kept on screen, with a small tail.
function bubble(g: CanvasRenderingContext2D, head: string, lines: readonly string[], cx: number, w: number, h: number, at: Placed, thought = false): void {
  const { x, y } = at;
  drawFrame(g, x, y, w, h);
  if (thought) {
    if (!at.moved) {
      g.fillStyle = PAL.ink;
      g.fillRect(cx - 1, y + h + 1, 3, 2);
      g.fillRect(cx, y + h + 4, 1, 1);
    }
  } else if (!at.moved) {
    g.fillStyle = PAL.panel;
    g.fillRect(cx - 2, y + h - 1, 4, 2);
    g.fillStyle = PAL.wood;
    g.fillRect(cx - 1, y + h + 1, 2, 2);
  }
  if (head) drawText(g, head, x + 6, y + 5, PAL.teal);
  const top = y + 5 + (head ? 10 : 0);
  lines.forEach((l, i) => drawText(g, l, x + 6, top + i * 10));
}
