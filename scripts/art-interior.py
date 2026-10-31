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
