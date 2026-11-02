# The player's home: the east wing of the pack's demo house, cut from the roofed and the open picture, so outside and
# inside are the same building at the same size. Run from the repo root.
from PIL import Image

ART = "client/public/art/sunny/"
LEFT = 97  # the wing's west wall, in home-roof.png and home-open.png

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
        # The demo's grass and rocks behind the roof are not part of this house.
        px = wing.load()
        for y in range(24):
            for x in [*range(27), *range(72, wing.width)]:
                r, g, b, a = px[x, y]
                if a and not (b > r or (r > 150 and r > g > b and b < 120)):
                    px[x, y] = (0, 0, 0, 0)
    wing.save(f"{ART}{out}.png")
    print(out, wing.size)
