#!/usr/bin/env node
// Node 22+ and an existing sharp installation; no downloads or subprocesses.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const usage = `Usage:
  node palette.mjs extract <refs-folder> [--colors 32] [--json .scratch/moodboard/palette.json] [--swatch .scratch/moodboard/palette.png]
  node palette.mjs quantize <image> --palette <palette.json|STYLE.md> --out <new.png>`;
const extensions = new Set(['.webp', '.png', '.jpg', '.jpeg']);
const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const rgb = value => value.match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16));
const fileKey = file => {
  let resolved = path.resolve(file);
  if (fs.existsSync(resolved)) resolved = fs.realpathSync.native(resolved);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

function readOptions(args) {
  const [command, input, ...rest] = args;
  if (command === '--help' || !command) { console.log(usage); process.exit(0); }
  if (!['extract', 'quantize'].includes(command) || !input || input.startsWith('--')) throw Error(usage);
  const options = {};
  const allowed = new Set(command === 'extract' ? ['colors', 'json', 'swatch'] : ['palette', 'out']);
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].slice(2), value = rest[i + 1];
    if (!rest[i].startsWith('--') || !allowed.has(key) || !value || value.startsWith('--') || key in options) throw Error(`Invalid option: ${rest[i]}\n${usage}`);
    options[key] = value;
  }
  return { command, input: path.resolve(input), options };
}

function listImages(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).flatMap(entry => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? listImages(file) : entry.isFile() && extensions.has(path.extname(file).toLowerCase()) ? [file] : [];
  });
}

function readPalette(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  let values;
  if (path.extname(file).toLowerCase() === '.json') {
    const data = JSON.parse(text);
    values = (Array.isArray(data) ? data : data.colors)?.map(entry => typeof entry === 'string' ? entry : entry.hex);
  } else {
    const block = text.match(/<!-- moodboard:palette:start -->([\s\S]*?)<!-- moodboard:palette:end -->/);
    if (!block) throw Error('Profile needs <!-- moodboard:palette:start --> and <!-- moodboard:palette:end --> markers.');
    values = block[1].match(/#[0-9a-f]{6}\b/gi);
  }
  if (!Array.isArray(values) || !values.length || values.some(v => typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v))) throw Error('Palette must contain #RRGGBB colors.');
  const colors = [...new Set(values.map(v => v.toUpperCase()))];
  if (colors.length > 32) throw Error('Profile palette exceeds 32 unique colors.');
  return colors.map(rgb);
}

function loadSharp() {
  // Resolve from this skill or the project's already installed dependencies.
  for (const base of [import.meta.url, new URL('../../../../worker/package.json', import.meta.url), new URL('../../../../client/package.json', import.meta.url)]) {
    try { return createRequire(base)('sharp'); } catch { /* try the next local installation */ }
  }
  throw Error('sharp is not available. This project uses worker/node_modules/sharp; no packages were installed by this helper.');
}

async function decodeImages(files, sample, sharp) {
  const images = [];
  for (const file of files) {
    if (!extensions.has(path.extname(file).toLowerCase())) throw Error('Supported images: WebP, PNG, JPEG.');
    let image = sharp(file, { limitInputPixels: 16777216 }).toColourspace('srgb').ensureAlpha();
    if (sample) image = image.resize(128, 128, { fit: 'inside', withoutEnlargement: true, kernel: 'nearest' });
    const { data, info } = await image.raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true });
    images.push({ width: info.width, height: info.height, rgba: data });
  }
  return images;
}

function dominantPalette(images, count) {
  const histogram = new Map();
  let contributors = 0;
  for (const { rgba } of images) {
    let alphaTotal = 0;
    for (let i = 3; i < rgba.length; i += 4) alphaTotal += rgba[i];
    if (!alphaTotal) continue;
    contributors++;
    for (let i = 0; i < rgba.length; i += 4) {
      if (!rgba[i + 3]) continue;
      const weight = rgba[i + 3] / alphaTotal;
      const key = (rgba[i] >> 3) * 1024 + (rgba[i + 1] >> 3) * 32 + (rgba[i + 2] >> 3);
      const bin = histogram.get(key) || { weight: 0, sums: [0, 0, 0] };
      bin.weight += weight;
      for (let c = 0; c < 3; c++) bin.sums[c] += rgba[i + c] * weight;
      histogram.set(key, bin);
    }
  }
  if (!contributors) throw Error('References contain no visible pixels.');
  const points = [...histogram.values()].map(bin => ({ weight: bin.weight, rgb: bin.sums.map(v => v / bin.weight) }));
  function box(points) {
    const weight = points.reduce((sum, p) => sum + p.weight, 0);
    const mean = [0, 1, 2].map(c => points.reduce((sum, p) => sum + p.rgb[c] * p.weight, 0) / weight);
    const variance = mean.map((v, c) => points.reduce((sum, p) => sum + (p.rgb[c] - v) ** 2 * p.weight, 0));
    const axis = variance.indexOf(Math.max(...variance));
    return { points, weight, mean, axis, score: points.length > 1 ? variance[axis] : -1 };
  }
  const boxes = [box(points)];
  while (boxes.length < count) {
    boxes.sort((a, b) => b.score - a.score);
    const current = boxes[0];
    if (current.score <= 0) break;
    current.points.sort((a, b) => a.rgb[current.axis] - b.rgb[current.axis]);
    let sum = 0, split = 0;
    do { sum += current.points[split++].weight; } while (sum < current.weight / 2 && split < current.points.length - 1);
    boxes.splice(0, 1, box(current.points.slice(0, split)), box(current.points.slice(split)));
  }
  const merged = new Map();
  for (const b of boxes) {
    const color = hex(b.mean);
    merged.set(color, (merged.get(color) || 0) + b.weight / contributors);
  }
  return { contributors, colors: [...merged].map(([hex, fraction]) => ({ hex, fraction })).sort((a, b) => b.fraction - a.fraction || a.hex.localeCompare(b.hex)) };
}

function png(width, height, rgba, sharp) {
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function write(file, data) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, data);
}

function swatch(colors, sharp) {
  const width = 8 * 64, height = Math.ceil(colors.length / 8) * 64;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = colors[Math.floor(y / 64) * 8 + Math.floor(x / 64)];
    if (color) pixels.set([...rgb(color.hex), 255], (y * width + x) * 4);
  }
  return png(width, height, pixels, sharp);
}

async function main() {
  const { command, input, options } = readOptions(process.argv.slice(2));
  const sharp = loadSharp();
  if (command === 'extract') {
    const count = Number(options.colors || 32);
    if (!Number.isInteger(count) || count < 2 || count > 32) throw Error('--colors must be an integer from 2 to 32.');
    const files = listImages(input);
    if (!files.length) throw Error('No PNG, JPEG, or WebP images found.');
    const jsonFile = path.resolve(options.json || '.scratch/moodboard/palette.json');
    const swatchFile = path.resolve(options.swatch || '.scratch/moodboard/palette.png');
    const protectedPaths = new Set(files.map(fileKey));
    if (fileKey(jsonFile) === fileKey(swatchFile) || protectedPaths.has(fileKey(jsonFile)) || protectedPaths.has(fileKey(swatchFile))) throw Error('Output paths must be distinct from one another and all reference images.');
    const result = dominantPalette(await decodeImages(files, true, sharp), count);
    const data = { schema_version: 1, kind: 'candidate-palette', method: 'equal-image alpha-weighted 128px nearest sample; 5-bit histogram; weighted median cut', source_count: files.length, contributing_images: result.contributors, sources: files.map(file => path.relative(process.cwd(), file).replaceAll('\\', '/')), colors: result.colors };
    const swatchPng = await swatch(data.colors, sharp);
    write(jsonFile, JSON.stringify(data, null, 2) + '\n');
    write(swatchFile, swatchPng);
    console.log(`Extracted ${data.colors.length} candidate colors from ${files.length} images -> ${jsonFile}\nSwatch -> ${swatchFile}`);
  } else {
    if (!options.palette || !options.out) throw Error('quantize requires --palette and --out.');
    const out = path.resolve(options.out), paletteFile = path.resolve(options.palette);
    if ([fileKey(input), fileKey(paletteFile)].includes(fileKey(out))) throw Error('Output must differ from the input and palette file.');
    if (path.extname(out).toLowerCase() !== '.png') throw Error('Quantized output must use .png.');
    const colors = readPalette(paletteFile);
    const image = (await decodeImages([input], false, sharp))[0];
    const cache = new Map();
    for (let i = 0; i < image.rgba.length; i += 4) {
      if (!image.rgba[i + 3]) { image.rgba.fill(0, i, i + 3); continue; }
      const key = image.rgba.readUIntBE(i, 3);
      let nearest = cache.get(key);
      if (!nearest) {
        let best = Infinity;
        for (const color of colors) {
          const distance = color.reduce((sum, v, c) => sum + (v - image.rgba[i + c]) ** 2, 0);
          if (distance < best) { nearest = color; best = distance; }
        }
        cache.set(key, nearest);
      }
      image.rgba.set(nearest, i);
    }
    write(out, await png(image.width, image.height, image.rgba, sharp));
    console.log(`Quantized ${image.width}x${image.height}, alpha preserved, ${colors.length} allowed colors -> ${out}`);
  }
}

try { await main(); } catch (error) { console.error(`palette: ${error.message}`); process.exitCode = 1; }
