"""Export PWA PNG icons from SVG sources (requires cairosvg)."""

from __future__ import annotations

from pathlib import Path

import cairosvg

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "public" / "icons"

EXPORTS = (
    ("icon.svg", "icon-{size}.png"),
    ("icon-maskable.svg", "icon-maskable-{size}.png"),
)


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        for svg_name, png_pattern in EXPORTS:
            svg_path = ICON_DIR / svg_name
            png_path = ICON_DIR / png_pattern.format(size=size)
            cairosvg.svg2png(
                url=str(svg_path),
                write_to=str(png_path),
                output_width=size,
                output_height=size,
            )
            print(f"[icons] {png_path.name} ({png_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
