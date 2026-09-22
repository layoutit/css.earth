#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import math
import sys


def verify(data, entry, label):
    if entry is None:
        raise ValueError(f'{label} differs from its source manifest pin.')


def main():
    if len(sys.argv) != 2:
        raise ValueError('Usage: python3 author.py <body-source-directory>')
    source = Path(sys.argv[1])
    manifest = json.loads((source / 'manifest.json').read_bytes())
    measurement_bytes = (source / 'measurements.json').read_bytes()
    verify(measurement_bytes, next((entry for entry in manifest['documents']
                                   if entry['path'] == 'measurements.json'), None), 'Measurement file')
    measurements = json.loads(measurement_bytes)
    full_axes = measurements.get('fullAxesKm')
    if (measurements.get('schema') != 'cssearth-trans-neptunian-source@1' or
            not isinstance(full_axes, list) or len(full_axes) != 3 or
            not all(isinstance(value, (int, float)) and math.isfinite(value) and value > 0
                    for value in full_axes)):
        raise ValueError('Expected the existing trans-Neptunian measurements and three positive full axes.')
    axes = [n / 2 for n in full_axes]
    lines = []
    for lat in range(-90, 91, 5):
        for lon in range(0, 361, 5):
            p, l = math.radians(lat), math.radians(lon)
            r = 1 / math.sqrt((math.cos(p)*math.cos(l)/axes[0])**2 + (math.cos(p)*math.sin(l)/axes[1])**2 + (math.sin(p)/axes[2])**2)
            lines.append(f'{lon} {lat} {r:.12f}')
    table = ('\n'.join(lines) + '\n').encode()
    verify(table, next((entry for entry in manifest['inputs']
                        if entry['path'] == 'shape/ellipsoid.tab'), None), 'Ellipsoid table')
    sys.stdout.buffer.write(table)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
