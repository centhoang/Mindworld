# The player's home: the east wing of the pack's demo house, cut from the roofed and the open picture, so outside and
# inside are the same building at the same size. Run from the repo root.
from PIL import Image

ART = "client/public/art/sunny/"
LEFT = 97  # the wing's west wall, in home-roof.png and home-open.png
AXIS = 123  # the side terraces mirror about x = 61.5: x and AXIS - x match
EAST = 102  # the east terrace, chimney and smoke trail start here; it takes the west terrace, mirrored
UPPER = 58  # the terraces end here; below is the wide lower roof


def eave_top(x):
    # The highest roof pixel of column x: the gable's two eaves rise 1 px per 2 columns to the ridge, the terraces
    # start at row 22. Anything above is the demo's world behind the house.
    if x < 22 or x > 101: return 22
    if x <= 53: return 18 - (x - 22) // 2
    if x >= 79: return 7 + (x - 79) // 2
    return 0
SHINGLE = {(11, 78, 143), (0, 152, 219), (34, 246, 253), (22, 110, 200), (165, 239, 247), (165, 255, 255), (169, 247, 245)}
SHADE = {(45, 132, 127), (61, 159, 164), (41, 181, 152), (75, 142, 160), (104, 134, 133), (112, 164, 177), (33, 90, 67), (30, 86, 46),
         (107, 75, 80), (78, 52, 68), (90, 72, 66), (122, 96, 80), (119, 108, 109), (100, 53, 58), (90, 59, 66), (107, 87, 98),
         (84, 67, 81), (140, 156, 181), (82, 107, 140), (109, 131, 163), (134, 143, 139)}  # shingles and planks in shadow
DARK = (29, 47, 71)  # the roof's outline colour, also what the shadow made of the darkest shingle
EAVE = {(234, 165, 108), (239, 214, 165), (198, 131, 100), (189, 108, 74), (198, 66, 33), (118, 59, 54)}


def clean_roof(wing):
    """Bug 38: the cut caught the demo's chimney smoke, rocks and a tree branch above the roof, and the dormers' cast
    shadows read as dark blocks on the shingles. Keep only the pack's roof: the clean west half of the upper gable,
    mirrored east, nothing above the eave line, and shingles under the shadows taken from the 16 px tile repeat."""
    px = wing.load()
    w, h = wing.size
    for y in range(UPPER):
        for x in range(EAST, w):
            px[x, y] = px[AXIS - x, y]
    for y in range(48, 66):  # the smoke trail crossed the east end of the middle gable too
        for x in range(98, EAST):
            px[x, y] = px[AXIS - x, y]
    for x in range(w):
        for y in range(24):
            r, g, b, _ = px[x, y]
            smoke = y < 6 and x > 72 and b > r > 120  # the last puff by the ridge
            if y < eave_top(x) or (g > r and g > b) or smoke:
                px[x, y] = (0, 0, 0, 0)
    shade = {(x, y) for y in range(h) for x in range(w) if px[x, y][3] and px[x, y][:3] in SHADE}
    near = lambda x, y: any((x + dx, y + dy) in shade for dx in range(-2, 3) for dy in range(-2, 3))
    shade |= {(x, y) for y in range(h) for x in range(w) if px[x, y][:3] == DARK and near(x, y)}
    # A blue shade becomes a shingle, a brown one a plank: copy the same spot of the next tile that is clear of shadow.
    steps = [(dx, dy) for dy in (0, 16, -16, 32) for dx in (16, -16, 32, -32, 48, -48, 0) if dx or dy]
    for x, y in sorted(shade, key=lambda p: (p[1], p[0])):
        if 50 <= x < 80 and y >= 29 + abs(x - 61.5) / 2:
            # On the middle gable's eaves, under the top dormer: the eave bands run 1 px down per 2 px out.
            out = -2 if x < 62 else 2
            k = next((k for k in range(1, 20) if (x + out * k, y + k) not in shade), None)
            if k is not None:
                px[x, y] = px[x + out * k, y + k]
                continue
        r, _, b, _ = px[x, y]
        fits = (lambda c: c in SHINGLE or c == DARK) if b >= r else (lambda c: c[0] > c[2])
        for dx, dy in steps:
            sx, sy = x + dx, y + dy
            if 0 <= sx < w and 0 <= sy < h and (sx, sy) not in shade and px[sx, sy][3] and fits(px[sx, sy][:3]):
                px[x, y] = px[sx, sy]
                break

for src, out in (("home-roof", "home-wing-roof"), ("home-open", "home-wing-open")):
    im = Image.open(f"{ART}{src}.png").convert("RGBA")
    wing = im.crop((LEFT, 0, im.width, im.height))
    if src == "home-open":
        # The wall the demo house left open towards its west wing: closed with the same wall, read from higher up.
        px = wing.load()
        top = next(y for y in range(wing.height) if px[0, y][3] > 0 and px[6, y][3] > 0) + 10
        for y in range(top, wing.height - 22):
            for x in range(0, 7):
                px[x, y] = px[x, top - 1]
    if src == "home-roof":
        clean_roof(wing)
    wing.save(f"{ART}{out}.png")
    print(out, wing.size)
