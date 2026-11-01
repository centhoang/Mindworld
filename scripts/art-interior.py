# The house interior: the pack's demo scene VisualAssetPack/BuiltDemo/Interior.gif at 1x, with the people painted out.
# Writes client/public/art/sunny/interior.png (roof off) and interior-roof.png (roof on, for the fade when you enter).
# Run after art-sunny.py, which writes a plain interior.png of its own.
from PIL import Image
import numpy as np

OUT = 'client/public/art/sunny/'
gif = Image.open('VisualAssetPack/BuiltDemo/Interior.gif')

def frame(k):
    gif.seek(k)
    return np.array(gif.convert('RGBA'))[0::4, 0::4].copy()  # the GIF is 4x; the first pixel of each block is enough

# Each patch: (x, y, w, h) to fill, and the (x, y) to copy it from.
SLEEPER = [
    ((122, 86, 24, 22), (144, 86)),              # the sleeper, from the planks beside it
    ((132, 72, 12, 8), (100, 72)),               # the Z's over the wall top
    ((132, 80, 12, 5), (84, 80)),
]
CROP = (0, 46, 264, 224)                         # leaves the people outside out of the picture

def patch(a, list_):
    for (x, y, w, h), (sx, sy) in list_:
        a[y:y + h, x:x + w] = a[sy:sy + h, sx:sx + w].copy()

inside = frame(60)
roof = frame(0)
GRASS = (150, 15)                                # plain grass near the top of the picture
EDGE = [((104, 46, 34, 10), GRASS), ((196, 46, 44, 7), GRASS)]  # what the crop would cut in half: a tree, the smoke
patch(inside, SLEEPER + EDGE)
patch(roof, EDGE)
for name, a in (('interior', inside), ('interior-roof', roof)):
    Image.fromarray(a).crop(CROP).save(OUT + name + '.png', optimize=True)

# The same house outdoors: both pictures cut to the house's own rooms, so entering lifts the roof in place on the
# overworld. In full-frame pixels: the two wings and what joins them; grass in their corners goes with a flood.
from collections import deque
ROOMS = [(139, 0, 263, 159), (42, 0, 121, 143), (118, 64, 140, 126)]
inside2, roof2 = frame(60), frame(0)
patch(inside2, SLEEPER)
h, w = roof2.shape[:2]
keep = np.zeros((h, w), bool)
for x0, y0, x1, y1 in ROOMS: keep[y0:y1, x0:x1] = True
green = lambda c: abs(int(c[0]) - 97) < 12 and abs(int(c[1]) - 196) < 12 and abs(int(c[2]) - 77) < 14
todo = deque((x, y) for y in range(h) for x in range(w) if keep[y, x] and not (keep[max(y - 1, 0), x] and keep[y, max(x - 1, 0)] and keep[y, min(x + 1, w - 1)]))
while todo:
    x, y = todo.popleft()
    if not (0 <= x < w and 0 <= y < h) or not keep[y, x] or not (green(roof2[y, x]) and green(inside2[y, x])): continue
    keep[y, x] = False
    todo.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
# Above the eaves, and inside once the roof is off, only what stands in the rooms is left: the world shows around it.
walls = np.zeros((h, w), bool)
for x0, y0, x1, y1 in ((139, 60, 263, 159), (42, 74, 121, 143), (118, 74, 140, 126)): walls[y0:y1, x0:x1] = True
rise = np.zeros((h, w), bool)
for y in range(h):
    for x in range(w):
        rise[y, x] = y >= 36 + 0.58 * abs(x - 81) if x < 121 else y >= 21 + 0.33 * abs(x - 207) if x >= 139 else y >= 64
keep &= rise
walls &= keep
ys, xs = np.where(keep)
box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
for name, a, shape in (('home-roof', roof2, keep), ('home-open', inside2, walls)):
    b = a.copy()
    b[~shape, 3] = 0
    Image.fromarray(b).crop(box).save(OUT + name + '.png', optimize=True)
print('home box', box)
