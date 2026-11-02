#!/usr/bin/env python3
"""Trace the Map tab's journey paths along the in-game map's yellow routes.

The Map tab used to join area nodes with straight lines, which cut
across land wherever the yellow road bends. This script replaces those
lines with paths that actually follow the yellow route bands on the
PokéNav map (public/hoenn-map.png, 257x159):

- Pixels in the map's yellow palette (plus town dots, so a path can
  reach a town node) are passable; the mask is dilated by 3px to bridge
  the town dots and small gaps in the road bands.
- BFS finds the shortest yellow-hugging path between consecutive nodes
  of each gym leg. Pairs with no yellow connection (surf crossings,
  backtrack jumps like Magma Hideout -> Route 124) get NO entry here;
  the Map tab renders those as a thin dashed connector instead of
  pretending they are roads.
- Paths are simplified (Douglas-Peucker, eps 1.5 at 257 scale), scaled
  4x into the 1028x636 viewBox, and bookended with the exact node
  coordinates so the line touches its node circles.

Output: src/data/mapPaths.ts (MAP_PATHS, keyed "from__to", where "to"
may be a boss id for a leg's final boss point).

Regenerate after changing maps.ts coordinates or pack cutoffs:
    python3 scripts/trace_map_paths.py
Requires Pillow (pip install pillow). Python 3.9 compatible.
"""

import json
import re
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROAD = {(225, 161, 0), (233, 185, 56), (241, 209, 80), (233, 225, 112)}
W, H = 257, 159


def is_townish(c):
    r, g, b = c
    return c == (249, 249, 249) or (r > 180 and g < 110 and b < 110)


def build_masks():
    from PIL import Image

    im = Image.open(ROOT / "public" / "hoenn-map.png").convert("RGB")
    small = im.resize((W, H), Image.NEAREST)
    px = small.load()
    road = [[px[x, y] in ROAD for x in range(W)] for y in range(H)]
    town = [[is_townish(px[x, y]) for x in range(W)] for y in range(H)]
    base = [[road[y][x] or town[y][x] for x in range(W)] for y in range(H)]
    mask = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if base[y][x]:
                for dy in range(-3, 4):
                    for dx in range(-3, 4):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < H:
                            mask[ny][nx] = True
    cost = [[1 if road[y][x] else (4 if town[y][x] else 12) for x in range(W)] for y in range(H)]
    return road, mask, cost


def nearest(mask, x, y, r=12):
    for d in range(r + 1):
        for dx in range(-d, d + 1):
            for dy in range(-d, d + 1):
                if max(abs(dx), abs(dy)) == d and 0 <= x + dx < W and 0 <= y + dy < H:
                    if mask[y + dy][x + dx]:
                        return (x + dx, y + dy)
    return None


def dijkstra(cost, mask, a, b):
    """Cheapest path through the mask, preferring real road pixels.

    Plain BFS finds the shortest path, which cuts corners across the
    dilated fringe and town dots instead of following the yellow band.
    Weighting road 1 / town 4 / fringe 12 keeps the path on the road
    wherever one exists and only crosses fringe for small gaps.
    Pixels outside the mask are blocked, so surf crossings still fail
    and render dashed.
    """
    import heapq

    s, t = nearest(mask, *a), nearest(mask, *b)
    if not s or not t:
        return None
    dist = {s: 0}
    prev = {s: None}
    pq = [(0, s)]
    while pq:
        d, cur = heapq.heappop(pq)
        if d != dist.get(cur):
            continue
        if cur == t:
            break
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                n = (cur[0] + dx, cur[1] + dy)
                if not (0 <= n[0] < W and 0 <= n[1] < H) or not mask[n[1]][n[0]]:
                    continue
                nd = d + cost[n[1]][n[0]] * (1.4142 if dx and dy else 1.0)
                if nd < dist.get(n, float("inf")):
                    dist[n] = nd
                    prev[n] = cur
                    heapq.heappush(pq, (nd, n))
    if t not in prev:
        return None
    path = []
    cur = t
    while cur:
        path.append(cur)
        cur = prev[cur]
    return path[::-1]


def simplify(points, eps):
    """Ramer-Douglas-Peucker; points are (x, y) tuples."""
    if len(points) <= 2:
        return points

    def dist(p, a, b):
        ax, ay = a
        bx, by = b
        px, py = p
        dx, dy = bx - ax, by - ay
        seg = dx * dx + dy * dy
        t = 0.0 if seg == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg))
        return ((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2) ** 0.5

    def rec(pts):
        if len(pts) <= 2:
            return pts
        a, b = pts[0], pts[-1]
        m = max(range(1, len(pts) - 1), key=lambda i: dist(pts[i], a, b))
        if dist(pts[m], a, b) <= eps:
            return [a, b]
        return rec(pts[: m + 1])[:-1] + rec(pts[m:])

    return rec(points)


def parse_points(src, block):
    m = re.search(block + r": \{(.*?)\n  \},", src, re.S)
    out = {}
    for k, x, y in re.findall(r'"([^"]+)": \{ x: (\d+), y: (\d+) \}', m.group(1)):
        out[k] = (round(int(x) / 4), round(int(y) / 4))
    return out


def main():
    road, mask, cost = build_masks()
    src = (ROOT / "src" / "data" / "maps.ts").read_text()
    areas = parse_points(src, "areas")
    bosses = parse_points(src, "bosses")
    pack = json.loads((ROOT / "src" / "data" / "packs" / "emerald.json").read_text())
    chain = [a["id"] for a in pack["areas"]]
    cutoffs = pack["bossAreaCutoffs"]
    # Legs, mirroring MapTab: segments with areas, variant orders collapsed.
    legs = []
    prev_idx = -1
    for b in sorted(pack["bosses"], key=lambda x: x["order"]):
        co = cutoffs.get(b["id"])
        if not co:
            continue
        idx = chain.index(co)
        seg = chain[prev_idx + 1 : idx + 1]
        prev_idx = idx
        if not seg:
            continue
        if legs and legs[-1][0]["order"] == b["order"]:
            legs[-1][1].extend(seg)
        else:
            legs.append((b, list(seg)))
    out = {}
    dashed = []
    for boss, seg in legs:
        pts = [(a, areas[a]) for a in seg if a in areas]
        pairs = [(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) for i in range(len(pts) - 1)]
        bp = bosses.get(boss["id"])
        if bp and pts and pts[-1][1] != bp:
            pairs.append((pts[-1][0], pts[-1][1], boss["id"], bp))
        for fa, pa, tb, pb in pairs:
            path = dijkstra(cost, mask, pa, pb)
            if not path:
                dashed.append(f"{fa} -> {tb} (no yellow connection)")
                continue
            # Quality gate: a real road path runs ON the yellow bands,
            # not across the dilated fringe between blobs. Dilation lets
            # BFS hop town dots and terrain blobs, which produces fake
            # cross-map chords (e.g. Abandoned Ship -> New Mauville
            # cutting diagonally over land). Reject those: they render
            # dashed instead. Short local hops are exempt — a stub
            # between two nearby nodes reads fine either way.
            straight = ((pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2) ** 0.5
            on_yellow = sum(1 for x, y in path if road[y][x]) / len(path)
            if straight > 20 and on_yellow < 0.6:
                dashed.append(f"{fa} -> {tb} (yellow {on_yellow:.2f})")
                continue
            # Strong simplification: the map's routes are straight
            # rectangular runs, and the highlight band is 44px wide in
            # the viewBox (11px at this scale), so corner cuts under
            # ~5px here stay inside the band. eps 4 keeps real corners
            # while collapsing BFS pixel wiggle into straight runs.
            simp = simplify(path, 4.0)
            # Bookend with exact node coords so the line touches its nodes.
            full = [pa] + [p for p in simp if p != pa and p != pb] + [pb]
            out[f"{fa}__{tb}"] = [[x * 4, y * 4] for x, y in full]
    lines = [
        "/**",
        " * Road-following journey paths for the Map tab, generated by",
        " * scripts/trace_map_paths.py — do not hand-edit. Each entry is a",
        " * polyline (1028x636 viewBox coords) tracing the in-game map's",
        " * yellow route bands between two consecutive journey nodes; the",
        " * key is \"from__to\" and \"to\" may be a boss id for a leg's final",
        " * boss point. Pairs with no yellow connection (surf crossings,",
        " * backtrack jumps) have no entry and render as a dashed",
        " * connector in the Map tab instead of a fake road.",
        " */",
        "export const MAP_PATHS: Record<string, [number, number][]> = {",
    ]
    for key in sorted(out):
        pts = ", ".join(f"[{x}, {y}]" for x, y in out[key])
        lines.append(f'  "{key}": [{pts}],')
    lines.append("};")
    (ROOT / "src" / "data" / "mapPaths.ts").write_text("\n".join(lines) + "\n")
    print(f"traced {len(out)} pairs, dashed {len(dashed)}: {dashed}")


if __name__ == "__main__":
    main()
