// Rebuild the native Sunnyside terrain: node scripts/art-tiles.mjs.
// No npm dependencies. Coordinates below are zero-based 16 px sheet cells.
// The ignored source pack is required; generated PNGs stay at logical resolution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
const rgba = hex => [...hex.slice(1).match(/../g).map(n => parseInt(n, 16)), 255];
const hexAt = (data, i) => '#' + Array.from(data.subarray(i, i + 3), n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
const canvas = (w, h, color) => {
  const im = { w, h, data: Buffer.alloc(w * h * 4) };
  if (color) for (let i = 0; i < im.data.length; i += 4) im.data.set(rgba(color), i);
  return im;
};
function put(im, x, y, color) {
  assert(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < im.w && y < im.h, `Pixel outside ${im.w}x${im.h}: ${x},${y}`);
  im.data.set(typeof color === 'string' ? rgba(color) : color, (y * im.w + x) * 4);
}
function crop(im, x, y, w, h) {
  assert(x >= 0 && y >= 0 && x + w <= im.w && y + h <= im.h, 'Crop outside source');
  const out = canvas(w, h);
  for (let row = 0; row < h; row++) im.data.copy(out.data, row * w * 4, ((y + row) * im.w + x) * 4, ((y + row) * im.w + x + w) * 4);
  return out;
}
// Integer pixel replication, for the review sheet only. Source sprites stay 1x.
function blit(dst, src, x, y, scale = 1) {
  assert(Number.isInteger(scale) && scale > 0);
  for (let sy = 0; sy < src.h; sy++) for (let sx = 0; sx < src.w; sx++) {
    const i = (sy * src.w + sx) * 4;
    if (!src.data[i + 3]) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const px = x + sx * scale + dx, py = y + sy * scale + dy;
      const j = (py * dst.w + px) * 4, alpha = src.data[i + 3] / 255;
      if (alpha === 1) put(dst, px, py, src.data.subarray(i, i + 4));
      else {
        // Original pack opacity is retained when compositing a reference.
        for (let c = 0; c < 3; c++) dst.data[j + c] = Math.round(src.data[i + c] * alpha + dst.data[j + c] * (1 - alpha));
        dst.data[j + 3] = 255;
      }
    }
  }
}

// PNG RGBA8 encoder; a decoder lets us verify bytes read back from disk and
// display original reference pixels, including all five PNG scanline filters.
const crcTable = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let n = 0; n < 8; n++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function encode(im) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(im.w, 0); header.writeUInt32BE(im.h, 4); header[8] = 8; header[9] = 6;
  const scanlines = Buffer.alloc(im.h * (im.w * 4 + 1));
  for (let y = 0; y < im.h; y++) im.data.copy(scanlines, y * (im.w * 4 + 1) + 1, y * im.w * 4, (y + 1) * im.w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('sRGB', Buffer.from([0])), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}
function decode(buf) {
  assert(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Not a PNG');
  let header, table, alpha, compressed = [];
  for (let offset = 8; offset < buf.length;) {
    const len = buf.readUInt32BE(offset), type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    assert.equal(crc32(buf.subarray(offset + 4, offset + 8 + len)), buf.readUInt32BE(offset + 8 + len), `PNG CRC ${type}`);
    if (type === 'IHDR') header = data;
    if (type === 'PLTE') table = data;
    if (type === 'tRNS') alpha = data;
    if (type === 'IDAT') compressed.push(data);
    offset += 12 + len;
  }
  const w = header.readUInt32BE(0), h = header.readUInt32BE(4), depth = header[8], type = header[9];
  assert.equal(header[12], 0, 'Interlaced PNG not supported');
  assert([2, 3, 6].includes(type), `PNG color type ${type}`);
  assert(type === 3 ? [1, 2, 4, 8].includes(depth) : depth === 8, `PNG bit depth ${depth}`);
  const channels = type === 6 ? 4 : type === 2 ? 3 : 1;
  const stride = Math.ceil(w * channels * depth / 8), bpp = Math.max(1, Math.ceil(channels * depth / 8));
  const raw = inflateSync(Buffer.concat(compressed));
  assert.equal(raw.length, (stride + 1) * h);
  const pixels = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    assert(filter <= 4, `PNG filter ${filter}`);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= bpp ? pixels[i - bpp] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= bpp ? pixels[i - stride - bpp] : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      pixels[i] = raw[y * (stride + 1) + 1 + x] + predictor;
    }
  }
  const out = canvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (type === 3) {
      const bit = x * depth, index = (pixels[y * stride + (bit >> 3)] >> (8 - depth - bit % 8)) & ((1 << depth) - 1);
      put(out, x, y, [table[index * 3], table[index * 3 + 1], table[index * 3 + 2], alpha?.[index] ?? 255]);
    } else {
      const i = y * stride + x * channels;
      put(out, x, y, [pixels[i], pixels[i + 1], pixels[i + 2], channels === 4 ? pixels[i + 3] : 255]);
    }
  }
  return out;
}

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = path.join(ROOT, 'client/public/art');
const REVIEW = path.join(ROOT, '.scratch/art');
const sheet = decode(fs.readFileSync(path.join(ROOT,
  'VisualAssetPack/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_16px.png')));
assert.equal(sheet.w, 1024); assert.equal(sheet.h, 1024);

const CELLS = {
  grass: [2, 1], grassFlecks: [2, 2], grassSparse: [3, 2],
  dirt: [1, 7], dirtFlecks: [9, 7], dirtSparse: [11, 7],
  // These are transparent grass-border overlays, oriented as named.
  pathN: [5, 8], pathE: [6, 7], pathS: [4, 7], pathW: [3, 8],
  water0: [30, 8], water1: [31, 8], water2: [32, 8], water3: [33, 8],
  shoreN: [26, 8], shoreE: [27, 7], shoreS: [25, 7], shoreW: [24, 8],
  shoreDiagonalNE: [26, 7],
  timber: [1, 9], bridgePanel: [40, 6],
  tuft: [27, 1], flowers: [33, 3],
};
const tile = name => { const [x, y] = CELLS[name]; return crop(sheet, x * 16, y * 16, 16, 16); };
const copy = im => crop(im, 0, 0, im.w, im.h);
const rotate = (im, turns) => {
  assert.equal(im.w, im.h);
  let result = copy(im);
  for (let n = 0; n < turns; n++) {
    const next = canvas(im.w, im.h);
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++)
      put(next, im.w - 1 - y, x, result.data.subarray((y * im.w + x) * 4, (y * im.w + x) * 4 + 4));
    result = next;
  }
  return result;
};
const grass = [tile('grass'), tile('grassFlecks'), tile('grassSparse')];
const dirt = [tile('dirt'), tile('dirtFlecks'), tile('dirtSparse')];
// Four native shallow-water animation cells share this bank's #32DCE8 base.
const water = Array.from({ length: 4 }, (_, f) => tile(`water${f}`));
const EDGES = [[1, 'N'], [2, 'E'], [4, 'S'], [8, 'W']];
const CORNERS = [
  { a: 1, b: 8, dx: -1, dy: -1, x: 0, y: 0, turns: 3 },
  { a: 1, b: 2, dx: 1, dy: -1, x: 13, y: 0, turns: 0 },
  { a: 4, b: 2, dx: 1, dy: 1, x: 13, y: 13, turns: 1 },
  { a: 4, b: 8, dx: -1, dy: 1, x: 0, y: 13, turns: 2 },
];
const pathTiles = Array.from({ length: 16 }, (_, mask) => {
  const im = copy(dirt[0]);
  for (const [bit, side] of EDGES) if (!(mask & bit)) blit(im, tile(`path${side}`), 0, 0);
  // At two closed edges the full native strips overlap. Replace their 3x3
  // crossing with native grass so no dark line cuts through the outer grass.
  for (const c of CORNERS) if (!(mask & (c.a | c.b)))
    blit(im, crop(grass[0], 0, 0, 3, 3), c.x, c.y);
  return im;
});
const shoreTiles = Array.from({ length: 16 }, (_, mask) => {
  const im = copy(grass[0]);
  // Native strips are opaque: copy only their actual 3 px bank so a second
  // side cannot erase the first side. No water tint is painted by hand.
  for (const [bit, side] of EDGES) if (mask & bit) {
    const x = side === 'E' ? 13 : 0, y = side === 'S' ? 13 : 0;
    const w = side === 'E' || side === 'W' ? 3 : 16;
    const h = side === 'N' || side === 'S' ? 3 : 16;
    blit(im, crop(tile(`shore${side}`), x, y, w, h), x, y);
  }
  // Two water sides meet in a rounded 3 px corner sampled from the native
  // diagonal bank, then rotated as whole pixels (never resampled).
  const corner = crop(tile('shoreDiagonalNE'), 7, 6, 3, 3);
  for (const c of CORNERS) if ((mask & (c.a | c.b)) === (c.a | c.b))
    blit(im, rotate(corner, c.turns), c.x, c.y);
  return im;
});
// A diagonal-only water neighbour needs only a tiny water nib at the corner,
// not a whole diagonal tile. This 3x3 source patch includes grass, rim, water.
const innerTiles = CORNERS.map(c => {
  const im = canvas(16, 16);
  blit(im, rotate(crop(tile('shoreDiagonalNE'), 7, 6, 3, 3), c.turns), c.x, c.y);
  return im;
});
const atlas = (cells, columns) => {
  const im = canvas(columns * 16, Math.ceil(cells.length / columns) * 16);
  cells.forEach((cell, n) => blit(im, cell, n % columns * 16, Math.floor(n / columns) * 16));
  return im;
};
const bridge = tile('timber');
const panel = tile('bridgePanel');
blit(bridge, crop(panel, 0, 0, 16, 2), 0, 0);
blit(bridge, crop(panel, 0, 14, 16, 2), 0, 14);
const bridgeEnd = copy(bridge);
blit(bridgeEnd, crop(panel, 0, 0, 2, 16), 0, 0);

// Only the grass ramps change. These are the existing autumn/snow hues from
// art.ts; all normal-season terrain uses original pack RGBA bytes.
const SEASONS = {
  autumn: { '#63C74D': '#D8A67A', '#87CF5E': '#EBC796', '#7BCF5C': '#EBC796', '#54B263': '#B88163', '#4FA748': '#B88163', '#4EA647': '#B88163', '#4DA76F': '#B88163', '#489956': '#BC756B', '#3E8948': '#BC756B', '#3D8847': '#BC756B', '#3F8E4F': '#BC756B' },
  snow: { '#63C74D': '#DDE1C6', '#87CF5E': '#FFF3D8', '#7BCF5C': '#FFF3D8', '#54B263': '#BFC7AF', '#4FA748': '#BFC7AF', '#4EA647': '#BFC7AF', '#4DA76F': '#BFC7AF', '#489956': '#9CAC9B', '#3E8948': '#9CAC9B', '#3D8847': '#9CAC9B', '#3F8E4F': '#9CAC9B' },
};
const recolor = (im, palette) => {
  const out = copy(im);
  for (let i = 0; i < out.data.length; i += 4) {
    const color = palette[hexAt(out.data, i)];
    if (out.data[i + 3] && color) out.data.set(rgba(color).slice(0, 3), i);
  }
  return out;
};
const outputs = new Map();
const save = (name, im) => outputs.set(`tile-${name}.png`, im);
grass.forEach((im, n) => save(`grass-${n}`, im));
water.forEach((im, n) => save(`water-${n}`, im));
dirt.forEach((im, n) => save(`path-${n}`, im));
save('path-atlas', atlas(pathTiles, 4)); save('shore-atlas', atlas(shoreTiles, 4));
save('shore-inner', atlas(innerTiles, 4));
save('bridge', bridge); save('bridge-end', bridgeEnd);
save('detail-tuft', tile('tuft')); save('detail-flowers', tile('flowers'));
for (const [season, palette] of Object.entries(SEASONS))
  grass.forEach((im, n) => save(`grass-${season}-${n}`, recolor(im, palette)));

// Midpoints prove each bit faces the correct neighbour, independently of the
// review renderer. The opposite case must be uninterrupted dirt / grass.
const probes = [[1, 8, 0], [2, 15, 8], [4, 8, 15], [8, 0, 8]];
for (let mask = 0; mask < 16; mask++) for (const [bit, x, y] of probes) {
  const i = (y * 16 + x) * 4;
  assert.equal(hexAt(pathTiles[mask].data, i), mask & bit ? '#E4A672' : '#54B263', `path mask ${mask}, side ${bit}`);
  assert.equal(hexAt(shoreTiles[mask].data, i), mask & bit ? '#4DA76F' : '#63C74D', `shore mask ${mask}, side ${bit}`);
}
// Native masks are byte-identical, including all alpha values.
for (const [mask, side] of EDGES) assert(shoreTiles[mask].data.equals(tile(`shore${side}`).data));
assert(pathTiles[15].data.equals(dirt[0].data));
for (const [n, c] of CORNERS.entries()) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
  if (x < c.x || x >= c.x + 3 || y < c.y || y >= c.y + 3)
    assert.equal(innerTiles[n].data[(y * 16 + x) * 4 + 3], 0, `inner corner ${n} leaks`);

// Keep the first originals on repeated runs, and reject unexpected dimensions.
fs.mkdirSync(path.join(REVIEW, 'tiles-old'), { recursive: true });
const sourcePixels = new Set();
for (let i = 0; i < sheet.data.length; i += 4) if (sheet.data[i + 3]) sourcePixels.add(sheet.data.readUInt32BE(i));
for (const [name, im] of outputs) {
  const dest = path.join(OUT, name), backup = path.join(REVIEW, 'tiles-old', name);
  const old = decode(fs.readFileSync(dest));
  assert.equal(im.w, old.w, `${name} width`); assert.equal(im.h, old.h, `${name} height`);
  if (!fs.existsSync(backup)) fs.copyFileSync(dest, backup);
  if (!/grass-(autumn|snow)-/.test(name)) for (let i = 0; i < im.data.length; i += 4)
    if (im.data[i + 3]) assert(sourcePixels.has(im.data.readUInt32BE(i)), `${name}: non-pack RGBA`);
  const bytes = encode(im);
  assert(decode(bytes).data.equals(im.data), `${name}: PNG round trip`);
  fs.writeFileSync(dest, bytes);
}

// Review drawing follows art.ts: cardinal masks, diagonal-only bank overlays,
// then detail overlays. Neighbours in each vignette are computed from its map.
const directions = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
function drawTerrain(dst, map, width, height, ox, oy, season) {
  const at = (x, y) => x < 0 || y < 0 || x >= width || y >= height ? 'w' : map[y][x];
  const themed = im => season ? recolor(im, SEASONS[season]) : im;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const kind = at(x, y);
    let im;
    if (kind === 'w') im = water[(x + y) & 3];
    else if (kind === 'b') im = bridge;
    else {
      const wm = directions.reduce((m, [dx, dy, bit]) => m | (at(x + dx, y + dy) === 'w' ? bit : 0), 0);
      const pm = directions.reduce((m, [dx, dy, bit]) => m | ('pb'.includes(at(x + dx, y + dy)) ? bit : 0), 0);
      const hash = Math.imul(x + 31, 374761393) ^ Math.imul(y + 17, 668265263);
      const variant = ((hash ^ hash >>> 13) >>> 0) % 3;
      im = themed(kind === 'p' ? pathTiles[pm] : wm ? shoreTiles[wm] : grass[variant]);
    }
    blit(dst, im, ox + x * 16, oy + y * 16);
    if (kind !== 'w' && kind !== 'b') {
      for (const [n, c] of CORNERS.entries()) if (at(x + c.dx, y + c.dy) === 'w' && at(x + c.dx, y) !== 'w' && at(x, y + c.dy) !== 'w')
        blit(dst, themed(innerTiles[n]), ox + x * 16, oy + y * 16);
      if (kind === 'f' || kind === 't') blit(dst, themed(tile(kind === 'f' ? 'flowers' : 'tuft')), ox + x * 16, oy + y * 16);
    }
  }
}
const check = canvas(448, 464, '#262B44');
// Small hexadecimal labels 0..F: rows ascend left to right (same as atlas).
const FONT = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001010010010','111101111101111','111101111001111','010101111101101','110101110101110','111100100100111','110101101101110','111100110100111','111100110100100'];
function label(n, x, y) {
  [...FONT[n]].forEach((p, i) => { if (p === '1') put(check, x + i % 3, y + Math.floor(i / 3), '#FFFFFF'); });
}
for (let group = 0; group < 2; group++) for (let mask = 0; mask < 16; mask++) {
  const map = Array.from({ length: 5 }, () => Array(5).fill('g'));
  map[2][2] = group ? 'g' : 'p';
  for (const [dx, dy, bit] of directions) map[2 + dy][2 + dx] = mask & bit ? group ? 'w' : 'p' : 'g';
  // Make both-water corners part of the water, leaving diagonal-only examples
  // for the concave cuts and small inlet in the mock island below.
  if (group) for (const c of CORNERS) if ((mask & (c.a | c.b)) === (c.a | c.b)) map[2 + c.dy][2 + c.dx] = 'w';
  const vignette = canvas(80, 80);
  drawTerrain(vignette, map, 5, 5, 0, 0);
  const x = group * 224 + mask % 4 * 56, y = Math.floor(mask / 4) * 56;
  blit(check, crop(vignette, 16, 16, 48, 48), x, y + 7);
  label(mask, x + 22, y);
}
const island = [
  'wwwwwwwwwwwwwwwwwwwwwwwwwwww',
  'wwwwgggggggggggggwwwwwwwwwww',
  'wwwgggggggggggggggggwwwwwwww',
  'wwggfggggppppggggggggwwwwwww',
  'wwgggggggppppggggggggwwgggww',
  'wwgggpppppppppppppppbbbpppgw',
  'wwgggpgfgggggggggggggwwgggww',
  'wwgggpppgggtgggggggggwwwwwww',
  'wwwggggpgggggggggggggwwwwwww',
  'wwwwgggpggggwwggggggwwwwwwww',
  'wwwwgggpggggwwggggggwwwwwwww',
  'wwwwgggpppgggggggggwwwwwwwww',
  'wwwwwgggggggggggggwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwwwwwwwwwww',
].map(row => [...row]);
assert(island.every(row => row.length === 28));
drawTerrain(check, island, 28, 14, 0, 232);
// A final seasonal strip checks that borders and grass use the same swaps.
for (const [i, season] of ['autumn', 'snow'].entries()) {
  const map = [['w','g','p','p','g','t','f','g','w','w','w','w','w','w']];
  drawTerrain(check, map, 14, 1, i * 224, 448, season);
}
const enlarged = canvas(check.w * 4, check.h * 4);
blit(enlarged, check, 0, 0, 4);
fs.writeFileSync(path.join(REVIEW, 'tiles-check.png'), encode(enlarged));
console.log(`Wrote ${outputs.size} native-size tiles; preserved originals in .scratch/art/tiles-old/.`);
console.log('Checked dimensions, pack-pixel provenance, PNG round trips, mask directions and corner transparency. Review .scratch/art/tiles-check.png (4x).');
console.log('Path: 0..14 composed, 15 native dirt. Shore: 0/1/2/4/8 native, other masks composed. Inner corners/bridge composed; four water frames native.');
