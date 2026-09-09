#!/usr/bin/env python3
"""Export the released DSK plates without resampling (spiceypy==7.0.0).

The gzip OBJ is a checked input to the JS preparer. CSPICE supplies the source
vertices in kilometers and one-based plate indices. No shape is synthesized.
"""
import argparse
import gzip
import spiceypy as spice

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source")
parser.add_argument("destination")
args = parser.parse_args()
handle = spice.dasopr(args.source)
try:
    segment = spice.dlabfs(handle)
    vertices, plates = spice.dskz02(handle, segment)
    positions = spice.dskv02(handle, segment, 1, vertices)
    indices = spice.dskp02(handle, segment, 1, plates)
    # A single released global plate set is required by this export.
    try:
        spice.dlafns(handle, segment)
    except spice.NotFoundError:
        has_next = False
    else:
        has_next = True
    if has_next:
        raise ValueError("Expected exactly one DSK segment")
    lines = ["# CSPICE DSK type 2 vertices in kilometers; original plate connectivity\n"]
    lines.extend("v " + " ".join(format(float(v), ".17g") for v in p) + "\n" for p in positions)
    lines.extend("f " + " ".join(str(int(v)) for v in p) + "\n" for p in indices)
    with open(args.destination, "wb") as output:
        output.write(gzip.compress("".join(lines).encode("ascii"), compresslevel=9, mtime=0))
    print(f"Exported {vertices} vertices and {plates} plates in kilometers")
finally:
    spice.dascls(handle)
