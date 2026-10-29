"""Draw and verify the eight static seasonal variants using Pillow, pixel by pixel."""

import json
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "client/public/art"
INK = "#39463F"

# Explicit connected clusters: no randomness, resampling, dithering or smoothing.
RECIPE = json.loads(r"""
{
  "tile_shapes": [
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [1, 0]],
    [[0, 0], [1, 0], [0, 1]]
  ],
  "tile_positions": [
    [[3, 3], [11, 11], [10, 4], [4, 9], [8, 12]],
    [[8, 2], [3, 11], [11, 9], [3, 5], [7, 12]],
    [[2, 8], [12, 3], [6, 3], [10, 11], [5, 11]]
  ],
  "autumn": {
    "tile_base": "#EBC796",
    "tile_colors": ["#B88163", "#B88163", "#BC756B", "#E69B86", "#EDC76A"],
    "canopy": {
      "#537D59": "#BC756B", "#78A05D": "#BC756B", "#9FC66A": "#D8A67A",
      "#BFDA82": "#EBC796", "#DDE8A3": "#EDC76A"
    },
    "leaves": [[[8, 18], [9, 18], [8, 19]], [[23, 12], [24, 12], [23, 13]]]
  },
  "snow": {
    "tile_base": "#FFF3D8",
    "tile_colors": ["#DDE1C6", "#BFC7AF", "#DDE1C6", "#DDE1C6", "#BFC7AF"],
    "canopy": {
      "#537D59": "#537D59", "#78A05D": "#537D59", "#9FC66A": "#78A05D",
      "#BFDA82": "#78A05D", "#DDE8A3": "#78A05D"
    },
    "caps": [
      [[1, 14, 20, 19], [2, 12, 22, 20], [3, 11, 22, 17], [4, 13, 20, 13]],
      [[5, 7, 14, 13], [6, 6, 16, 14], [7, 5, 15, 11], [8, 7, 13, 7]],
      [[5, 20, 25, 24], [6, 19, 26, 25], [7, 20, 26, 22]],
      [[16, 18, 23, 22], [17, 18, 24, 22], [18, 19, 22, 19]],
      [[22, 4, 8, 7], [23, 3, 9, 7], [24, 4, 8, 4]]
    ]
  }
}
""")


def rgba(color, alpha=255):
    return (*bytes.fromhex(color.lstrip("#")), alpha)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_palette():
    style = (ROOT / "docs/STYLE.md").read_text(encoding="utf-8")
    block = style.split("<!-- moodboard:palette:start -->", 1)[1]
    block = block.split("<!-- moodboard:palette:end -->", 1)[0]
    palette = {rgba(color)[:3] for color in re.findall(r"#[0-9A-Fa-f]{6}", block)}
    require(len(palette) == 28, "Expected the marked 28-color STYLE.md palette")
    return palette


def make_tile(season, variant):
    recipe = RECIPE[season]
    tile = Image.new("RGBA", (16, 16), rgba(recipe["tile_base"]))
    for shape, origin, color in zip(
        RECIPE["tile_shapes"], RECIPE["tile_positions"][variant], recipe["tile_colors"]
    ):
        for dx, dy in shape:
            tile.putpixel((origin[0] + dx, origin[1] + dy), rgba(color))
    return tile


def make_tree(source, season):
    recipe = RECIPE[season]
    recolors = {rgba(old): rgba(new) for old, new in recipe["canopy"].items()}
    tree = source.copy()
    canopy = set()
    for y in range(source.height):
        for x in range(source.width):
            pixel = source.getpixel((x, y))
            if pixel in recolors:
                canopy.add((x, y))
                tree.putpixel((x, y), recolors[pixel])
            elif pixel[3] == 0:
                tree.putpixel((x, y), rgba(INK, 0))
    if season == "autumn":
        for leaf in recipe["leaves"]:
            for point in leaf:
                require(tuple(point) in canopy, "Autumn leaf must stay inside the canopy")
                tree.putpixel(tuple(point), rgba("#E69B86"))
    else:
        # Each cap is 3-4 rows thick; cream faces NW, cool color rims the SE edge.
        for cap in recipe["caps"]:
            for y, left, right, shade_start in cap:
                for x in range(left, right):
                    if (x, y) in canopy:
                        color = "#FFF3D8" if x < shade_start else "#DDE1C6"
                        tree.putpixel((x, y), rgba(color))
    return tree


def verify(path, expected_size, palette, source, season, is_tile):
    with Image.open(path) as image:
        require(image.format == "PNG" and image.mode == "RGBA", f"{path.name}: PNG/RGBA")
        require(image.size == expected_size, f"{path.name}: wrong size")
        pixels = [image.getpixel((x, y)) for y in range(image.height) for x in range(image.width)]
        require(all(p[:3] in palette for p in pixels), f"{path.name}: outside palette")
        require({p[3] for p in pixels} <= {0, 255}, f"{path.name}: nonbinary alpha")
        if is_tile:
            require(all(p[3] == 255 for p in pixels), f"{path.name}: transparent terrain")
            base = rgba(RECIPE[season]["tile_base"])
            fraction = pixels.count(base) / len(pixels)
            require(0.95 <= fraction <= 0.96, f"{path.name}: terrain detail density")
            require(all(image.getpixel((x, y)) == base
                        for y in range(16) for x in range(16)
                        if x < 2 or x > 13 or y < 2 or y > 13), f"{path.name}: seam")
            detail = f"fully opaque; base={fraction:.2%}; matching 2px borders"
        else:
            require(image.getchannel("A").tobytes() == source.getchannel("A").tobytes(),
                    f"{path.name}: tree alpha mask changed")
            foliage = {rgba(color) for color in RECIPE[season]["canopy"]}
            for y in range(source.height):
                for x in range(source.width):
                    original = source.getpixel((x, y))
                    if original[3] == 255 and original not in foliage:
                        require(image.getpixel((x, y)) == original,
                                f"{path.name}: trunk/outline changed at {(x, y)}")
            detail = "alpha mask exact; trunk/outline unchanged"
        print(f"PASS {path.relative_to(ROOT).as_posix()}: {image.width}x{image.height}; "
              f"palette OK; binary alpha; {detail}")


def main():
    palette = load_palette()
    with Image.open(ART / "prop-tree.png") as original:
        source = original.convert("RGBA")
    require(source.size == (32, 48), "Expected a 32x48 source tree")
    for season in ("autumn", "snow"):
        for variant in range(3):
            path = ART / f"tile-grass-{season}-{variant}.png"
            make_tile(season, variant).save(path)
            verify(path, (16, 16), palette, source, season, is_tile=True)
        path = ART / f"prop-tree-{season}.png"
        make_tree(source, season).save(path)
        verify(path, (32, 48), palette, source, season, is_tile=False)
    print("Verified all 8 seasonal PNGs.")


if __name__ == "__main__":
    main()
