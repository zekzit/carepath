"""Generate simple PNG floor plans for โรงพยาบาลวชิระ.

Reads `nodes.csv` + `floors.csv` from the same directory and writes
one PNG per floor into `floor_plans/`. Each plan is 1200x800 px and
matches the (pos_x, pos_y) coordinates in `nodes.csv`, so admin can
drag-place the generated PNG as the floor background and nodes will
already be aligned with the same coordinate system.

Run from the repo root (or anywhere):

    python seed/generate_floor_plans.py
"""

from __future__ import annotations

import csv
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
NODES_CSV = HERE / "nodes.csv"
FLOORS_CSV = HERE / "floors.csv"
OUT_DIR = HERE / "floor_plans"

CANVAS_W = 1200
CANVAS_H = 800

BG = (250, 250, 250)
WALL = (90, 90, 90)
TITLE_BG = (40, 55, 90)
TITLE_FG = (255, 255, 255)

NODE_COLORS = {
    "SERVICE_POINT": (220, 80, 70),     # red
    "JUNCTION": (130, 130, 130),        # gray
    "VERTICAL_CONNECTOR": (80, 130, 220),  # blue
    "KIOSK": (255, 165, 0),             # orange
    "ENTRANCE": (40, 170, 80),          # green
}


def _font(size: int) -> ImageFont.ImageFont:
    # Ayuthaya.ttf has full Thai coverage; Arial Unicode covers Latin fallback.
    # We register a font set so PIL can pick Thai glyphs from Ayuthaya and
    # Latin glyphs from Arial Unicode when needed.
    for path in ("/System/Library/Fonts/Supplemental/Ayuthaya.ttf",
                 "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
                 "/System/Library/Fonts/Supplemental/Arial.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def _room_box(x: float, y: float, label: str) -> tuple[float, float, float, float]:
    """Return a 220x140 box centered around (x, y) for a service-point room."""
    w, h = 220, 140
    return (x - w / 2, y - h / 2, x + w / 2, y + h / 2)


def _draw_node(draw: ImageDraw.ImageDraw, node: dict, code_font, label_font) -> None:
    ntype = node["node_type"]
    color = NODE_COLORS.get(ntype, (100, 100, 100))
    x = float(node["pos_x"])
    y = float(node["pos_y"])

    if ntype == "SERVICE_POINT":
        box = _room_box(x, y, node["service_point_code"])
        draw.rectangle(box, outline=WALL, width=2, fill=(255, 245, 240))
        cx = (box[0] + box[2]) / 2
        cy = (box[1] + box[3]) / 2
        draw.text((cx, cy - 18), node["service_point_code"], font=code_font,
                  fill=(20, 20, 20), anchor="mm")
        # truncate long Thai/EN names
        name = node["name_en"]
        if len(name) > 24:
            name = name[:22] + ".."
        draw.text((cx, cy + 8), name, font=label_font, fill=(60, 60, 60), anchor="mm")
        return

    if ntype == "VERTICAL_CONNECTOR":
        draw.ellipse((x - 28, y - 28, x + 28, y + 28), fill=color, outline=WALL, width=2)
        text = "STAIRS" if "Stairs" in node["name_en"] else "ELEV"
        draw.text((x, y), text, font=code_font, fill=(255, 255, 255), anchor="mm")
        draw.text((x, y + 38), node["name_en"], font=label_font, fill=(40, 40, 40), anchor="mm")
        return

    if ntype == "KIOSK":
        draw.rectangle((x - 30, y - 22, x + 30, y + 22), fill=color, outline=WALL, width=2)
        draw.text((x, y), "KIOSK", font=code_font, fill=(255, 255, 255), anchor="mm")
        draw.text((x, y + 34), node["device_code"] or "", font=label_font,
                  fill=(40, 40, 40), anchor="mm")
        return

    if ntype == "ENTRANCE":
        draw.polygon([(x, y - 30), (x + 26, y + 18), (x - 26, y + 18)],
                     fill=color, outline=WALL, width=2)
        draw.text((x, y - 40), "ENTRANCE", font=code_font, fill=(40, 40, 40), anchor="mm")
        return

    # JUNCTION
    draw.rectangle((x - 16, y - 16, x + 16, y + 16), fill=color, outline=WALL, width=2)


def _draw_edges(draw: ImageDraw.ImageDraw, edges: list[dict],
                nodes_by_id: dict[str, dict]) -> None:
    for e in edges:
        a = nodes_by_id.get(e["from_node_id"])
        b = nodes_by_id.get(e["to_node_id"])
        if not a or not b:
            continue
        ax, ay = float(a["pos_x"]), float(a["pos_y"])
        bx, by = float(b["pos_x"]), float(b["pos_y"])
        # only draw edges where both endpoints are on the same floor
        if a["floor_id"] != b["floor_id"]:
            continue
        etype = e["edge_type"]
        if etype == "CORRIDOR":
            color = (180, 180, 180)
            width = 4
        elif etype == "ELEVATOR":
            color = (80, 130, 220)
            width = 3
        elif etype == "STAIRS":
            color = (200, 100, 100)
            width = 3
        else:
            color = (150, 150, 150)
            width = 3
        draw.line([(ax, ay), (bx, by)], fill=color, width=width)


def _draw_scale_bar(draw: ImageDraw.ImageDraw, scale_m_per_px: float) -> None:
    """Draw a 5 m scale bar in the bottom-left corner."""
    bar_m = 5.0
    bar_px = int(bar_m / scale_m_per_px)
    x0, y0 = 40, CANVAS_H - 50
    draw.rectangle((x0, y0, x0 + bar_px, y0 + 14), outline=WALL, width=2, fill=(255, 255, 255))
    draw.text((x0, y0 - 18), f"{bar_m:.0f} m", font=_font(18), fill=(40, 40, 40))
    draw.text((x0 + bar_px + 8, y0 + 7), f"({bar_px} px @ {scale_m_per_px} m/px)",
              font=_font(14), fill=(80, 80, 80))


def _draw_title(draw: ImageDraw.ImageDraw, title: str, subtitle: str) -> None:
    draw.rectangle((0, 0, CANVAS_W, 56), fill=TITLE_BG)
    draw.text((20, 28), title, font=_font(26), fill=TITLE_FG, anchor="lm")
    draw.text((CANVAS_W - 20, 28), subtitle, font=_font(18), fill=TITLE_FG, anchor="rm")


def _load_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    nodes = _load_csv(NODES_CSV)
    floors = _load_csv(FLOORS_CSV)
    nodes_by_id = {n["id"]: n for n in nodes}

    code_font = _font(18)
    label_font = _font(13)
    small_font = _font(11)

    # edges live in the same file, we just need a way to filter per floor
    edges_path = HERE / "edges.csv"
    edges = _load_csv(edges_path) if edges_path.exists() else []

    for floor in floors:
        floor_id = floor["id"]
        floor_nodes = [n for n in nodes if n["floor_id"] == floor_id]

        img = Image.new("RGB", (CANVAS_W, CANVAS_H), BG)
        draw = ImageDraw.Draw(img)

        _draw_title(draw, f"โรงพยาบาลวชิระ — {floor['name_th']}",
                    f"Vajira Hospital — {floor['name_en']}")
        _draw_scale_bar(draw, float(floor["plan_scale_m_per_px"]))
        _draw_edges(draw, edges, nodes_by_id)

        for node in floor_nodes:
            _draw_node(draw, node, code_font, label_font)

        # legend
        legend_x, legend_y = CANVAS_W - 230, CANVAS_H - 130
        draw.rectangle((legend_x, legend_y, legend_x + 210, legend_y + 110),
                       outline=WALL, width=1, fill=(255, 255, 255))
        draw.text((legend_x + 10, legend_y + 14), "Legend", font=_font(14), fill=(20, 20, 20))
        ly = legend_y + 36
        for ntype, color in NODE_COLORS.items():
            draw.rectangle((legend_x + 10, ly, legend_x + 24, ly + 12), fill=color, outline=WALL)
            draw.text((legend_x + 32, ly + 6), ntype, font=small_font, fill=(20, 20, 20), anchor="lm")
            ly += 18

        out_path = OUT_DIR / floor["plan_image_filename"]
        img.save(out_path, "PNG")
        print(f"wrote {out_path.relative_to(HERE.parent)} ({len(floor_nodes)} nodes)")


if __name__ == "__main__":
    main()
