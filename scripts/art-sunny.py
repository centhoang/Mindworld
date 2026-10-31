# Export the Sunnyside art the game uses: python scripts/art-sunny.py
# Tiles, then stamps cut from the pack's example room (houses, props, furniture), and animated strips.
# The pack stays gitignored; only what this writes under client/public/art/sunny is committed.
import json, os, re, shutil
from PIL import Image
ROOT = 'VisualAssetPack/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_ASSET_PACK_V2.1/'
A = ROOT + 'Sunnyside_World_Assets/'
G = ROOT + 'Sunnyside_World_Gamemaker/'
OUT = 'client/public/art/sunny/'
os.makedirs(OUT, exist_ok=True)

src = open(G + 'rooms/Room1/Room1.yy', encoding='utf8').read()
room = json.loads(re.sub(r',\s*([}\]])', r'\1', src))
def decode(t):
    if 'TileSerialiseData' in t: return t['TileSerialiseData']
    c, o, i = t['TileCompressedData'], [], 0
    while i < len(c):
        n = c[i]; i += 1
        if n < 0: o += [c[i]] * -n; i += 1
        else: o += c[i:i + n]; i += n
    return o
LAYERS = {l['name']: decode(l['tiles']) for l in room['layers'] if 'tiles' in l and l['tiles']['SerialiseWidth'] == 86}
sheet = Image.open(A + 'Tileset/spr_tileset_sunnysideworld_16px.png').convert('RGBA')
sheet.save(OUT + 'tiles.png', optimize=True)

def tile(v):
    v &= 0xffffffff
    if v >> 31 or not v & 0x7ffff: return None
    i = v & 0x7ffff
    t = sheet.crop(((i % 64) * 16, (i // 64) * 16, (i % 64) * 16 + 16, (i // 64) * 16 + 16))
    if v >> 28 & 1: t = t.transpose(Image.FLIP_LEFT_RIGHT)
    if v >> 29 & 1: t = t.transpose(Image.FLIP_TOP_BOTTOM)
    if v >> 30 & 1: t = t.transpose(Image.ROTATE_270)
    return t
def stamp(layers, x0, y0, x1, y1):
    im = Image.new('RGBA', ((x1 - x0) * 16, (y1 - y0) * 16))
    for n in layers:
        for y in range(y0, y1):
            for x in range(x0, x1):
                t = tile(LAYERS[n][y * 86 + x])
                if t: im.alpha_composite(t, ((x - x0) * 16, (y - y0) * 16))
    return im
HOUSE = ['building', 'walls', 'decoration_02', 'decoration_03']
DEC = ['decoration_01']
# name: layers, tile rect. Boxes trim to the art, with the foot at the bottom centre.
STAMPS = {
    'house-blue': (HOUSE, 39, 24, 46, 31), 'house-red': (HOUSE, 32, 18, 37, 24), 'house-green': (HOUSE, 21, 25, 25, 29),
    'house-redsmall': (HOUSE, 30, 26, 34, 30), 'house-purple': (HOUSE, 13, 26, 19, 32), 'house-orange': (HOUSE, 54, 24, 60, 29),
    'house-orangelong': (HOUSE, 55, 31, 61, 35), 'house-bluesmall': (HOUSE, 51, 6, 55, 10), 'house-greentall': (HOUSE, 40, 32, 45, 38),
    'stall-red': (HOUSE, 64, 27, 68, 30), 'stall-white': (HOUSE, 33, 28, 37, 31),
    'pine': (DEC, 4, 2, 6, 5), 'bush': (DEC, 20, 12, 22, 14), 'bush-berry': (DEC, 23, 12, 25, 14), 'bush-red': (DEC, 52, 13, 54, 15),
    'rock-big': (DEC, 63, 18, 65, 20), 'rock-small': (DEC, 54, 21, 56, 22), 'sign': (DEC, 9, 36, 10, 37), 'stump': (DEC, 26, 15, 27, 17), 'fence-a': (DEC, 9, 21, 12, 22), 'fence-b': (DEC, 12, 21, 15, 22),
    'ladder': (DEC, 27, 37, 29, 42), 'statue': (DEC, 6, 31, 10, 35), 'jar': (DEC, 10, 32, 11, 33),
    'crates': (DEC, 62, 22, 65, 25), 'crate': (DEC, 70, 26, 72, 28), 'soil': (DEC, 9, 8, 10, 9), 'bench': (DEC, 11, 33, 14, 34),
}
LOOSE = {'fence-a', 'fence-b'}  # several pieces on purpose
def largest(im):
    # Keep the biggest connected blob: the rects catch bits of neighbouring props.
    a = im.getchannel('A').load()
    W, H = im.size
    seen, best = set(), []
    for y in range(H):
        for x in range(W):
            if (x, y) in seen or not a[x, y]: continue
            stack, blob = [(x, y)], []
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop()
                blob.append((cx, cy))
                for q in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and a[q]:
                        seen.add(q)
                        stack.append(q)
            if len(blob) > len(best): best = blob
    out = Image.new('RGBA', im.size)
    px, keep = im.load(), out.load()
    for q in best: keep[q] = px[q]
    return out
boxes = {}
for name, (layers, x0, y0, x1, y1) in STAMPS.items():
    im = stamp(layers, x0, y0, x1, y1)
    b = im.getbbox()
    if not b:
        print('EMPTY', name)
        continue
    if name not in LOOSE: im = largest(im)
    im = im.crop(im.getbbox())
    im.save(OUT + name + '.png', optimize=True)
    boxes[name] = [im.width, im.height]

# Furniture, straight from the tileset: [row, col, w, h] in tiles.
FURNITURE = {'bed': (33, 40, 2, 2), 'rug': (35, 40, 3, 3), 'table': (35, 50, 2, 3), 'stool': (33, 49, 1, 2), 'shelf': (33, 42, 1, 2), 'vase': (32, 47, 1, 1), 'sunflower': (32, 52, 1, 2), 'picture': (33, 54, 1, 1), 'cupboard': (33, 46, 1, 2), 'sidetable': (33, 47, 1, 2)}
for name, (r, c, w, h) in FURNITURE.items():
    im = sheet.crop((c * 16, r * 16, (c + w) * 16, (r + h) * 16))
    im = im.crop(im.getbbox())
    im.save(OUT + 'f-' + name + '.png', optimize=True)

# The room inside a house: rim, plank floor, front wall with the door gap. 24 x 14 tiles (384 x 216).
def t(r, c, m=False):
    return (r * 64 + c) | ((1 << 28) if m else 0)
inside = Image.new('RGBA', (384, 216))
for r in range(14):
    for c in range(24):
        inside.alpha_composite(tile(t(3, 1)), (c * 16, r * 16))
def lay(col, row, v):
    inside.alpha_composite(tile(v), (col * 16, row * 16))
L, R, TOP, BOT = 5, 18, 4, 12  # walls; the floor is cols 6-17, rows 6-11
for c in range(L, R + 1):
    lay(c, TOP, t(9, 8) if c == L else t(9, 8, True) if c == R else t(9, 4))
    lay(c, BOT, t(10, 6) if c == L else t(10, 6, True) if c == R else t(10, 5))
    lay(c, BOT + 1, t(10, 8))
for r in range(TOP + 1, BOT):
    for c in range(L, R + 1):
        lay(c, r, t(9, 6) if c == L else t(9, 6, True) if c == R else t(9, 1))
for c in (11, 12):  # the door
    lay(c, BOT, t(9, 1))
    lay(c, BOT + 1, t(11, 12))
def furnish(name, x, y):
    im = Image.open(OUT + 'f-' + name + '.png')
    inside.alpha_composite(im, (x, y))
furnish('picture', 8 * 16, 5 * 16)
furnish('picture', 15 * 16, 5 * 16)
inside.save(OUT + 'interior.png', optimize=True)

# Animated and single sprites, unchanged.
def copy(path, to=None):
    shutil.copy(A + path, OUT + (to or os.path.basename(path)))
for p in ['Plants/spr_deco_tree_01_strip4.png', 'Plants/spr_deco_tree_02_strip4.png', 'Plants/spr_deco_mushroom_red_01_strip4.png', 'Plants/spr_deco_mushroom_blue_01_strip4.png',
          'Animals/spr_deco_bird_01_strip4.png', 'Animals/spr_deco_duck_01_strip4.png', 'Animals/spr_deco_chicken_01_strip4.png', 'Animals/spr_deco_sheep_01_strip4.png', 'Animals/spr_deco_pig_01_strip4.png', 'Animals/spr_deco_cow_strip4.png',
          'Other/spr_deco_windmill_withshadow_strip9.png', 'Other/spr_deco_coracle_strip4.png',
          'VFX/Chimney Smoke/chimneysmoke_01_strip30.png', 'VFX/Glint/spr_deco_glint_01_strip6.png', 'VFX/Glint/spr_deco_glint_02_strip4.png', 'VFX/Fire/spr_deco_fire_01_strip4.png']:
    copy('Elements/' + p)
for c in ['beetroot', 'cabbage', 'carrot', 'cauliflower', 'kale', 'parsnip', 'potato', 'pumpkin', 'radish']:
    for i in range(6):
        copy(f'Elements/Crops/{c}_0{i}.png', f'crop-{c}-{i}.png')
for i in range(6):
    shutil.copy(G + f'sprites/wheat_0{i}/' + sorted(f for f in os.listdir(G + f'sprites/wheat_0{i}') if f.endswith('.png'))[0], OUT + f'crop-wheat-{i}.png')
for u in ['expression_chat.png', 'expression_love.png', 'expression_alerted.png', 'label_left.png', 'label_middle.png', 'label_right.png', 'itemdisc_01.png', 'itemdisc_02.png']:
    copy('UI/' + u)
for s in ['spr_deco_charactershadow', 'spr_deco_shadow', 'spr_deco_well', 'spr_deco_campfire', 'spr_deco_firepit', 'spr_deco_chair_01', 'spr_deco_sidetable_01', 'spr_deco_rug_01', 'spr_deco_barrel_water', 'spr_deco_crate_01', 'spr_deco_flowers_house_01']:
    d = G + 'sprites/' + s + '/'
    pngs = sorted(f for f in os.listdir(d) if f.endswith('.png'))
    if not pngs:
        print('NO PNG', s)
        continue
    print(s, len(pngs), Image.open(d + pngs[0]).size)
    shutil.copy(d + pngs[0], OUT + s + '.png')
for hair in ['base', 'bowlhair', 'curlyhair', 'longhair', 'mophair', 'shorthair', 'spikeyhair', 'tools']:
    shutil.copy(A + f'Characters/Human/RUN/{hair}_run_strip8.png', f'client/public/art/humans/{hair}_run_strip8.png')

# Clouds: the example room's cloud clusters as tile lists; the grey and shadow versions sit 3 and 6 rows below.
d = LAYERS['clouds_01']
seen, clouds = set(), []
for k in range(len(d)):
    v = d[k] & 0xffffffff
    if k in seen or v >> 31 or not v & 0x7ffff or not 1153 <= (v & 0x7ffff) < 1248:
        continue
    stack, cells = [k], []
    seen.add(k)
    while stack:
        q = stack.pop()
        cells.append(q)
        for n in (q - 1, q + 1, q - 86, q + 86):
            if 0 <= n < len(d) and n not in seen and not (d[n] & 0xffffffff) >> 31 and d[n] & 0x7ffff:
                seen.add(n)
                stack.append(n)
    if 4 <= len(cells) <= 40:
        x0 = min(c % 86 for c in cells)
        y0 = min(c // 86 for c in cells)
        clouds.append([[c % 86 - x0, c // 86 - y0, d[c] & 0x7ffffff] for c in cells])
print('clouds', [len(c) for c in clouds])
ts = json.loads(re.sub(r',\s*([}\]])', r'\1', open(G + 'tilesets/tileset_sunnysideworld/tileset_sunnysideworld.yy', encoding='utf8').read()))
anims = [a['frames'] for a in ts['tileAnimationFrames']]
json.dump({'stamps': boxes, 'clouds': clouds, 'anims': anims}, open(OUT + 'sunny.json', 'w'), separators=(',', ':'))

# Review sheet.
W = 1100
x = y = 4
rowh = 0
rev = Image.new('RGBA', (W, 700), (99, 199, 77, 255))
for n in boxes:
    im = Image.open(OUT + n + '.png')
    s = im.resize((im.width * 2, im.height * 2), 0)
    if x + s.width > W:
        x = 4
        y += rowh + 6
        rowh = 0
    rev.alpha_composite(s, (x, y))
    x += s.width + 8
    rowh = max(rowh, s.height)
rev.save('.scratch/room/stamps.png')
