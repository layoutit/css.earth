"""Extract the numeric cut planes and outer mantle surface from a pinned EMC model.

Preparation input maintenance only; the normal JS bake reads the checked-in subset.
Requires Python 3, numpy and h5py. See Earth's SOURCE.md for the exact invocation.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

import h5py
import numpy as np


def extract(model_path, recipe_path, output_path):
    recipe = json.loads(Path(recipe_path).read_text())
    source = recipe["source"]
    with open(model_path, "rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != source["sha256"]:
        raise ValueError("The upstream tomography model differs from its pin")
    with h5py.File(model_path) as model:
        lat = model["latitude"][:].astype(np.float64)
        lon = model["longitude"][:].astype(np.float64)
        depth = model["depth"][:].astype(np.float64)
        assert np.array_equal(lat, np.arange(-90, 91))
        assert np.array_equal(lon, np.arange(-180, 181))
        assert np.array_equal(depth, np.arange(10, 2891, 10))
        field = model[source["variable"]][:].astype(np.float64)
        assert field.shape == (289, 181, 361)
        assert np.isfinite(field).all() and (field > 0).all()
        # The published -180/+180 samples differ slightly (up to 0.081 km/s).
        # They occupy the same physical meridian: average the pair for periodic
        # sampling, then count that meridian once in the horizontal mean.
        seam = (field[:, :, 0] + field[:, :, -1]) / 2
        field[:, :, 0] = seam
        field[:, :, -1] = seam
        # Exact areas of the latitude cells centered on each source grid point.
        edges = np.radians(np.r_[-90, (lat[:-1] + lat[1:]) / 2, 90])
        weights = np.diff(np.sin(edges))
        means = (field[:, :, :-1].mean(axis=2) * weights).sum(axis=1) / weights.sum()
        sections = []
        for longitude in recipe["sectionLongitudesDegrees"]:
            index = (longitude + 180) % 360
            low = int(np.floor(index))
            fraction = index - low
            sections.append(field[:, :, low] * (1 - fraction) + field[:, :, low + 1] * fraction)
        index = (recipe["shellDepthKm"] - depth[0]) / 10
        low = int(np.floor(index))
        fraction = index - low
        shell = field[low] * (1 - fraction) + field[low + 1] * fraction
        # Layout: depth means, [face, depth, south-to-north latitude], surface.
        values = np.concatenate([means.ravel(), *[a.ravel() for a in sections], shell.ravel()])
        payload = values.astype("<f4").tobytes()
        # Empty filename and fixed mtime make the gzip envelope reproducible.
        with open(output_path, "wb") as stream:
            with gzip.GzipFile(filename="", mode="wb", fileobj=stream, mtime=0, compresslevel=9) as zipped:
                zipped.write(payload)
    print(json.dumps({"bytes": Path(output_path).stat().st_size,
                      "sha256": hashlib.sha256(Path(output_path).read_bytes()).hexdigest(),
                      "values": len(values)}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model")
    parser.add_argument("recipe")
    parser.add_argument("output")
    args = parser.parse_args()
    extract(args.model, args.recipe, args.output)
