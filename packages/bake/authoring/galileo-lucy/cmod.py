"""Inspect Celestia's binary mesh without running its renderer.

The binary tokens and vertex layout follow Celestia src/celmodel/modelfile.cpp.
This deliberately accepts only the position/normal/UV triangle meshes used by
the pinned Dinkinesh and Selam release. Unsupported blocks fail explicitly.
Source vertices, nonzero triangle winding and UV coordinates are preserved.
Exactly zero-area source faces are omitted and listed in the conversion receipt.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct


def decode(data):
    if data[:16] != b"#celmodel_binary":
        raise ValueError("Expected binary CMOD signature")
    offset = 16

    def read(fmt):
        nonlocal offset
        size = struct.calcsize("<" + fmt)
        if offset + size > len(data):
            raise ValueError("Truncated CMOD")
        values = struct.unpack_from("<" + fmt, data, offset)
        offset += size
        return values[0] if len(values) == 1 else values

    def expect(value):
        if read("H") != value:
            raise ValueError(f"Expected CMOD token {value} at {offset - 2}")

    expect(1001)
    expect(1003)
    expect(7)
    color = read("3f")
    if color != (1.0, 1.0, 1.0):
        raise ValueError("Unaccounted source material color")
    expect(1002)
    meshes = []
    while offset < len(data):
        expect(1009)
        expect(1011)
        for semantic, format_id in [(0, 2), (3, 2), (5, 1)]:
            if read("2H") != (semantic, format_id):
                raise ValueError("Unsupported vertex layout")
        expect(1012)
        expect(1013)
        count = read("I")
        if not 0 < count <= 200000:
            raise ValueError("Invalid vertex count")
        vertices = [read("8f") for _ in range(count)]
        if not all(math.isfinite(v) for row in vertices for v in row):
            raise ValueError("Non-finite vertex")
        expect(0)  # Triangle list
        material, index_count = read("2I")
        if material not in (0, 0xFFFFFFFF) or index_count % 3:
            raise ValueError("Unsupported triangle group")
        if index_count > 1200000:
            raise ValueError("Invalid index count")
        faces = [read("3I") for _ in range(index_count // 3)]
        if any(max(face) >= count or len(set(face)) != 3 for face in faces):
            raise ValueError("Invalid triangle")
        expect(1010)
        meshes.append((vertices, faces))
    return meshes


def inspect(path, maximum_extent_meters):
    data = path.read_bytes()
    meshes = decode(data)
    vertices, faces = [], []
    for rows, triangles in meshes:
        base = len(vertices)
        vertices.extend(rows)
        faces.extend(tuple(v + base for v in f) for f in triangles)
    source_face_count = len(faces)
    omitted = []
    kept = []
    for index, face in enumerate(faces):
        a, b, c = (vertices[i] for i in face)
        u = [b[k] - a[k] for k in range(3)]
        v = [c[k] - a[k] for k in range(3)]
        cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        if not any(cross):
            omitted.append(index)
        else:
            kept.append(face)
    faces = kept
    minimum = [min(v[k] for v in vertices) for k in range(3)]
    maximum = [max(v[k] for v in vertices) for k in range(3)]
    midpoint = [(a + b) / 2 for a, b in zip(minimum, maximum)]
    scale = maximum_extent_meters / max(b - a for a, b in zip(minimum, maximum))
    # Celestia is Y-up. This proper rotation makes the body mesh Z-up.
    positions = [((v[0] - midpoint[0]) * scale,
                  -(v[2] - midpoint[2]) * scale,
                  (v[1] - midpoint[1]) * scale) for v in vertices]
    def determinant(a, b, c):
        return (a[0] * (b[1] * c[2] - b[2] * c[1])
                + a[1] * (b[2] * c[0] - b[0] * c[2])
                + a[2] * (b[0] * c[1] - b[1] * c[0]))
    volume = sum(determinant(*(positions[i] for i in f)) for f in faces) / 6
    extents = [max(p[k] for p in positions) - min(p[k] for p in positions)
               for k in range(3)]
    return positions, vertices, faces, {
        "sourceSha256": hashlib.sha256(data).hexdigest(),
        "sourceBytes": len(data), "meshes": len(meshes),
        "vertices": len(vertices), "faces": len(faces),
        "sourceFaces": source_face_count,
        "omittedZeroAreaSourceFaceIndices": omitted,
        "sourceBoundingBoxCenter": midpoint,
        "scaleMetersPerSourceUnit": scale,
        "axisTransform": "[x,y,z] -> [x,-z,y]; proper rotation, winding unchanged",
        "fullExtentsMeters": extents,
        "signedVolumeCubicMeters": volume,
        "volumeEquivalentRadiusKm": (abs(volume) * 3 / (4 * math.pi)) ** (1 / 3) / 1000,
        "meaning": "Authored reconstruction; dimensions do not establish measured terrain or registration",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--maximum-extent-meters", type=float)
    group.add_argument("--volume-equivalent-radius-km", type=float)
    args = parser.parse_args()
    if args.volume_equivalent_radius_km is not None:
        if not math.isfinite(args.volume_equivalent_radius_km) or args.volume_equivalent_radius_km <= 0:
            raise ValueError("Volume-equivalent radius must be positive")
        *_, unit_report = inspect(args.input, 1)
        args.maximum_extent_meters = args.volume_equivalent_radius_km / unit_report["volumeEquivalentRadiusKm"]
    if not math.isfinite(args.maximum_extent_meters) or args.maximum_extent_meters <= 0:
        raise ValueError("Physical extent must be positive")
    positions, rows, faces, report = inspect(args.input, args.maximum_extent_meters)
    report["scaleConvention"] = ("published-volume-equivalent-radius" if args.volume_equivalent_radius_km
                                 else "maximum-extent")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w") as f:
        f.write("# Converted CMOD; metres; Z-up; original UVs; zero-area source faces omitted.\n")
        for p in positions:
            f.write("v " + " ".join(format(v, ".17g") for v in p) + "\n")
        for row in rows:
            f.write(f"vt {row[6]:.12g} {row[7]:.12g}\n")
        for face in faces:
            f.write("f " + " ".join(f"{i + 1}/{i + 1}" for i in face) + "\n")
    args.output.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
