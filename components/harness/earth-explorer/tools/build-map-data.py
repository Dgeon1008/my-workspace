"""Convert locally extracted Natural Earth 1:50m shapefiles to app JSON.

Expected folders under app/.geodata-source:
  countries, country-borders, rivers, physical-areas

The converter uses only Python's standard library. The generated file is used
at runtime, so the globe itself does not need network access or extra packages.
"""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / "app"
SOURCE = ROOT / ".geodata-source"
OUTPUT = ROOT / "world-features.json"


def dbf_rows(path: Path):
    raw = path.read_bytes()
    count = struct.unpack_from("<I", raw, 4)[0]
    header_size = struct.unpack_from("<H", raw, 8)[0]
    record_size = struct.unpack_from("<H", raw, 10)[0]
    fields = []
    offset = 32
    while raw[offset] != 0x0D:
        descriptor = raw[offset : offset + 32]
        name = descriptor[:11].split(b"\0", 1)[0].decode("ascii")
        fields.append((name, descriptor[16]))
        offset += 32

    rows = []
    for index in range(count):
        record = raw[header_size + index * record_size : header_size + (index + 1) * record_size]
        if not record or record[0] == 0x2A:
            rows.append({})
            continue
        cursor = 1
        row = {}
        for name, size in fields:
            value = record[cursor : cursor + size].decode("utf-8", "replace").strip("\0 ")
            row[name] = value
            cursor += size
        rows.append(row)
    return rows


def shape_records(path: Path):
    raw = path.read_bytes()
    shape_type = struct.unpack_from("<i", raw, 32)[0]
    offset = 100
    while offset + 8 <= len(raw):
        content_size = struct.unpack_from(">i", raw, offset + 4)[0] * 2
        start = offset + 8
        record = raw[start : start + content_size]
        offset = start + content_size
        if len(record) < 4:
            yield []
            continue
        record_type = struct.unpack_from("<i", record, 0)[0]
        if record_type == 0:
            yield []
        elif record_type == 1:
            yield [[struct.unpack_from("<2d", record, 4)]]
        elif record_type in (3, 5, 13, 15):
            part_count, point_count = struct.unpack_from("<2i", record, 36)
            part_offsets = struct.unpack_from(f"<{part_count}i", record, 44) if part_count else ()
            points_offset = 44 + 4 * part_count
            points = [struct.unpack_from("<2d", record, points_offset + index * 16) for index in range(point_count)]
            boundaries = list(part_offsets) + [point_count]
            yield [points[boundaries[i] : boundaries[i + 1]] for i in range(len(part_offsets))]
        else:
            raise ValueError(f"Unsupported shape type {record_type} in {path.name} (file type {shape_type})")


def simplify(points, tolerance):
    if len(points) <= 2:
        return points
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    tolerance_sq = tolerance * tolerance
    while stack:
        first, last = stack.pop()
        x1, y1 = points[first]
        x2, y2 = points[last]
        dx, dy = x2 - x1, y2 - y1
        denom = dx * dx + dy * dy
        best_index, best_distance = -1, tolerance_sq
        for index in range(first + 1, last):
            x, y = points[index]
            if denom:
                ratio = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / denom))
                px, py = x1 + ratio * dx, y1 + ratio * dy
            else:
                px, py = x1, y1
            distance = (x - px) ** 2 + (y - py) ** 2
            if distance > best_distance:
                best_index, best_distance = index, distance
        if best_index >= 0:
            keep.add(best_index)
            stack.append((first, best_index))
            stack.append((best_index, last))
    return [points[index] for index in sorted(keep)]


def rounded(points, tolerance):
    reduced = simplify(points, tolerance)
    return [[round(lon, 3), round(lat, 3)] for lon, lat in reduced]


def text(row, *keys):
    for key in keys:
        value = row.get(key, "").strip()
        if value:
            return value
    return ""


def integer(row, key, fallback=0):
    try:
        return int(float(row.get(key, "")))
    except (TypeError, ValueError):
        return fallback


def find_point(rings):
    """Return a representative interior label point for a possibly multipart range."""
    candidates = []
    for ring in rings:
        if len(ring) < 4:
            continue
        area_twice = 0.0
        cx = cy = 0.0
        for index, (x1, y1) in enumerate(ring[:-1]):
            x2, y2 = ring[index + 1]
            cross = x1 * y2 - x2 * y1
            area_twice += cross
            cx += (x1 + x2) * cross
            cy += (y1 + y2) * cross
        area = abs(area_twice) * 0.5
        if area < 1e-7:
            continue
        centroid = (cx / (3 * area_twice), cy / (3 * area_twice)) if area_twice else ring[0]
        candidates.append((area, ring, centroid))
    if not candidates:
        points = [point for ring in rings for point in ring]
        return (sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)) if points else (0, 0)

    def contains(point):
        x, y = point
        inside = False
        for ring in rings:
            in_ring = False
            for index, (x1, y1) in enumerate(ring[:-1]):
                x2, y2 = ring[index + 1]
                if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                    in_ring = not in_ring
            inside = inside or in_ring
        return inside

    xs = [point[0] for _, ring, _ in candidates for point in ring]
    ys = [point[1] for _, ring, _ in candidates for point in ring]
    center = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
    if contains(center):
        return center
    best_scan = None
    for step in range(101):
        y = min(ys) + (max(ys) - min(ys)) * step / 100
        for _, ring, _ in candidates:
            intersections = []
            for index, (x1, y1) in enumerate(ring[:-1]):
                x2, y2 = ring[index + 1]
                if (y1 > y) != (y2 > y):
                    intersections.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
            intersections.sort()
            for left, right in zip(intersections[::2], intersections[1::2]):
                point = ((left + right) / 2, y)
                score = abs(point[0] - center[0]) + abs(point[1] - center[1]) * 0.65 - min(right - left, 20) * 0.015
                if best_scan is None or score < best_scan[0]:
                    best_scan = (score, point)
    if best_scan:
        return best_scan[1]
    nearest = min(candidates, key=lambda item: (item[2][0] - center[0]) ** 2 + (item[2][1] - center[1]) ** 2)
    _, ring, centroid = nearest
    if contains(centroid):
        return centroid
    if contains(ring[0]):
        return ring[0]
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    best = ring[0]
    for row in range(1, 10):
        for column in range(1, 10):
            point = (min(xs) + (max(xs) - min(xs)) * column / 10, min(ys) + (max(ys) - min(ys)) * row / 10)
            if contains(point):
                best = point
                break
        else:
            continue
        break
    return best


def layer(folder, suffix):
    return next((SOURCE / folder).glob(f"*{suffix}"))


def country_data():
    shapes = shape_records(layer("country-borders", ".shp"))
    rows = dbf_rows(layer("country-borders", ".dbf"))
    borders = []
    for parts, row in zip(shapes, rows):
        if not row:
            continue
        for part in parts:
            line = rounded(part, 0.025)
            if len(line) >= 2:
                borders.append(line)

    rows = dbf_rows(layer("countries", ".dbf"))
    countries = []
    for row in rows:
        if not row:
            continue
        lon, lat = row.get("LABEL_X", ""), row.get("LABEL_Y", "")
        try:
            lon, lat = float(lon), float(lat)
        except ValueError:
            continue
        name = text(row, "NAME_KO", "NAME_EN", "ADMIN")
        if not name:
            continue
        if name == "중화인민공화국":
            name = "중국"
        elif name == "오스트레일리아":
            name = "호주"
        countries.append({
            "name": name,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "populationRank": integer(row, "POP_RANK"),
            "labelRank": integer(row, "LABELRANK", 99),
        })
    return borders, countries


def river_data():
    shapes = shape_records(layer("rivers", ".shp"))
    rows = dbf_rows(layer("rivers", ".dbf"))
    grouped = {}
    for parts, row in zip(shapes, rows):
        if not row or row.get("featurecla", "").lower() != "river":
            continue
        rank = integer(row, "scalerank", 9)
        if rank > 5:
            continue
        name = text(row, "name_ko", "name_en", "name")
        if not name:
            continue
        item = grouped.setdefault(name, {"name": name, "rank": rank, "lines": [], "label": None, "length": 0.0})
        item["rank"] = min(item["rank"], rank)
        for part in parts:
            line = rounded(part, 0.035)
            if len(line) < 2:
                continue
            item["lines"].append(line)
            length = sum(math.hypot((b[0] - a[0]) * math.cos(math.radians((a[1] + b[1]) / 2)), b[1] - a[1]) for a, b in zip(part, part[1:]))
            if length > item["length"]:
                midpoint = part[len(part) // 2]
                item["label"] = [round(midpoint[0], 4), round(midpoint[1], 4)]
                item["length"] = length
    rivers = []
    for item in grouped.values():
        item.pop("length")
        item["lon"], item["lat"] = item.pop("label") or [0, 0]
        rivers.append(item)
    return sorted(rivers, key=lambda river: (river["rank"], river["name"]))


def mountain_data():
    shapes = shape_records(layer("physical-areas", ".shp"))
    rows = dbf_rows(layer("physical-areas", ".dbf"))
    grouped = {}
    for parts, row in zip(shapes, rows):
        if not row or row.get("FEATURECLA", "").lower() != "range/mtn":
            continue
        rank = integer(row, "SCALERANK", 9)
        if rank > 4:
            continue
        name = text(row, "NAME_KO", "NAME_EN", "NAME")
        if not name:
            continue
        rings = [part for part in parts if len(part) >= 4]
        if not rings:
            continue
        item = grouped.setdefault(name, {"name": name, "rank": rank, "rings": [], "label": None, "size": 0.0})
        item["rank"] = min(item["rank"], rank)
        item["rings"].extend(rounded(ring, 0.08) for ring in rings)
        label = find_point(rings)
        size = max((abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring[:-1], ring[1:])) / 2) for ring in rings), default=0)
        if size > item["size"]:
            item["label"] = [round(label[0], 4), round(label[1], 4)]
            item["size"] = size
    mountains = []
    for item in grouped.values():
        item.pop("size")
        item["lon"], item["lat"] = item.pop("label") or [0, 0]
        mountains.append(item)
    return sorted(mountains, key=lambda mountain: (mountain["rank"], mountain["name"]))


def main():
    borders, countries = country_data()
    data = {
        "source": "Natural Earth 1:50m",
        "countryBorders": borders,
        "countries": countries,
        "rivers": river_data(),
        "mountains": mountain_data(),
    }
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUTPUT.name}: {len(borders)} border lines, {len(countries)} countries, {len(data['rivers'])} rivers, {len(data['mountains'])} mountain ranges ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
