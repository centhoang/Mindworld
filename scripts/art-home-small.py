# Every player's house (bug 46): the small house drawn in the pack's blue (client/public/art/gen/home-small-roof.png) is
# recoloured into the pack's other four roof colours, and its open room is copied beside them. The tileset holds the same
# house parts in five colours, 128 px apart in rows: a blue pixel's colour in the green, orange, red and purple blocks at
# the same offset is its colour there. Only roof colours change (those that change in every block); walls, door and the
# stone chimney stay. Run from the repo root: python scripts/art-home-small.py [roofed.png]
import sys
from collections import Counter, defaultdict

from PIL import Image

ART = "client/public/art/sunny/"
SRC = sys.argv[1] if len(sys.argv) > 1 else "client/public/art/gen/home-small-roof.png"
OPEN = "client/public/art/gen/home-small-open.png"
BLUE = (240, 140, 560, 268)  # the blue house parts in tiles.png: x0, y0, x1, y1
ROOFS = {"green": 128, "orange": 256, "red": 384, "purple": 512}


def colour_maps():
    sheet = Image.open(f"{ART}tiles.png").convert("RGBA")
    px = sheet.load()
    x0, y0, x1, y1 = BLUE
    maps = {}
    for name, off in ROOFS.items():
        seen = defaultdict(Counter)
        for y in range(y0, y1):
            for x in range(x0, x1):
                a, b = px[x, y], px[x, y + off]
                if a[3] == 255 and b[3] == 255:
                    seen[a[:3]][b[:3]] += 1
        maps[name] = {k: c.most_common(1)[0][0] for k, c in seen.items()}
    roof = {k for k in maps["green"] if all(m.get(k, k) != k for m in maps.values())}
    return {name: {k: v for k, v in m.items() if k in roof} for name, m in maps.items()}


def shade_of(c, m):
    """A blue-green shade the tileset block lacks (a shadow under the chimney) takes the nearest roof colour's place."""
    r, g, b = c
    if not (g > r + 40 and b > r + 40):
        return None
    near = min(m, key=lambda k: sum((x - y) ** 2 for x, y in zip(k, c)))
    return m[near]


def main():
    house = Image.open(SRC).convert("RGBA")
    house.save(f"{ART}home-small-blue.png")
    for name, m in colour_maps().items():
        out = house.copy()
        px = out.load()
        for y in range(out.height):
            for x in range(out.width):
                p = px[x, y]
                to = m.get(p[:3]) or shade_of(p[:3], m) if p[3] else None
                if to:
                    px[x, y] = (*to, p[3])
        out.save(f"{ART}home-small-{name}.png")
    if SRC.endswith("home-small-roof.png"):
        Image.open(OPEN).convert("RGBA").save(f"{ART}home-small-open.png")
    print("wrote", ", ".join(["blue", *ROOFS]))


main()
