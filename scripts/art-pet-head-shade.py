# Bug 32: redraw the light patch on every pet head as a crescent that follows the round head.
# Reads the original body layers from a folder (default the live ones) and writes the live ones.
import glob, os, sys
from PIL import Image

LIVE = "client/public/art/gen/pets"
SRC = sys.argv[1] if len(sys.argv) > 1 else LIVE
LIGHT, BASE = (232, 173, 125), (200, 127, 91)
DEPTH = {16: 1, 32: 2, 48: 3}


def inside(x, y, cx, cy, rx, ry):
    return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1


for path in sorted(glob.glob(f"{SRC}/*-body-base-*.png")):
    name = os.path.basename(path)
    im = Image.open(path).convert("RGBA")
    n = im.width
    px = im.load()
    lit = [(x, y) for y in range(n) for x in range(n) if px[x, y][:3] == LIGHT and px[x, y][3]]
    top, join = min(y for _, y in lit), max(y for _, y in lit)
    # The head is the silhouette down to the end of the old patch: fit its ellipse.
    rows = [[x for x in range(n) if px[x, y][3]] for y in range(top, join + 1)]
    left, right = min(r[0] for r in rows), max(r[-1] for r in rows) + 1
    cx, rx = (left + right) / 2, (right - left) / 2
    ry = max(join + 1 - top, rx * 0.8)
    cy = top + ry
    d = DEPTH[n]
    for y in range(n):
        for x in range(n):
            if px[x, y][3] and px[x, y][:3] in (LIGHT, BASE):
                on = inside(x, y, cx, cy, rx, ry) and not inside(x, y, cx + d, cy + d, rx, ry)
                # Only along the outside of the head, never as an arc across the body.
                on = on and any(not px[max(0, x - i), max(0, y - j)][3] for i in range(d + 2) for j in range(d + 2))
                px[x, y] = (*(LIGHT if on else BASE), 255)
    im.save(f"{LIVE}/{name}")
