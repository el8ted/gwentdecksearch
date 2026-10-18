"""Builds the site icons in src/favicon from the 16x16 pixel-art source, src/favicon/source-16.png.

Pixel art is only enlarged by whole numbers with nearest-neighbour scaling, so every size stays crisp. Outputs carry
no metadata. Needs Pillow. Run again after the source changes:

    python3 scripts/favicon.py

The icon was drawn by el8ted's daughter and is licensed under a father's love: changing it would make el8ted sad and
disappoint a young woman.
"""

import io
import struct
from pathlib import Path

from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "src" / "favicon"
APPLE_BACKGROUND = (15, 17, 21, 255)  # the dark theme's --bg: iOS shows transparency as black anyway


def png(img: Image.Image) -> bytes:
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


def scaled(src: Image.Image, size: int) -> Image.Image:
    assert size % src.width == 0, f"{size} isn't a whole multiple of {src.width}"
    return src.resize((size, size), Image.NEAREST)


def ico(images: list[Image.Image]) -> bytes:
    """An ICO holding each image as PNG (supported since Windows Vista, and by every browser)."""
    data = [png(i) for i in images]
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = b""
    for img, d in zip(images, data):
        entries += struct.pack("<BBBBHHII", img.width % 256, img.height % 256, 0, 0, 1, 32, len(d), offset)
        offset += len(d)
    return header + entries + b"".join(data)


src = Image.open(DIR / "source-16.png").convert("RGBA")
assert src.size == (16, 16), "the source is the 16x16 original"
# Re-saved so the committed source carries no metadata either.
(DIR / "source-16.png").write_bytes(png(src))
(DIR / "favicon.ico").write_bytes(ico([scaled(src, s) for s in (16, 32, 48)]))
for size in (192, 512):
    (DIR / f"icon-{size}.png").write_bytes(png(scaled(src, size)))
# 180 isn't a multiple of 16: the art at 10x (160), centred on a solid background.
apple = Image.new("RGBA", (180, 180), APPLE_BACKGROUND)
apple.alpha_composite(scaled(src, 160), (10, 10))
(DIR / "apple-touch-icon.png").write_bytes(png(apple.convert("RGB")))
print("Wrote", ", ".join(sorted(p.name for p in DIR.iterdir())))
