# B8 reproduction and review

Run from the repository root. The body-owned recipes, original numerical files,
derived GeoTIFFs and interpretation/license snapshots are checked in beside Io,
Ganymede and Enceladus. This directory contains the batch's replay and evidence
tools; none is imported by the application runtime.

## Numerical maps

Python needs NumPy and Rasterio. Independent figure checks also need Matplotlib
and Pillow. Use one process at a time, with `OPENBLAS_NUM_THREADS=1` and
`OMP_NUM_THREADS=1`.

```sh
python3 -m unittest discover -s tools/objects/acquisition -p 'test_*spectral*.py'
python3 tools/objects/acquisition/muse-spectral-maps.py src/planets/io/source/muse/io-recipe.json
python3 tools/objects/acquisition/muse-spectral-maps.py src/planets/ganymede/source/muse/ganymede-recipe.json
python3 tools/objects/acquisition/enceladus-vims-spectral.py src/planets/enceladus/source/vims-chemistry/prepare.json
```

`node docs/moons/b8-surface-chemistry/restore-and-reproduce.mjs` creates an empty
directory under `output/b8-source-reproduction`, fetches only the 21 selected
original numerical files through the real acquisition operations, runs both
converters and requires all 11 derived scientific maps to match byte for byte.
Set `B8_PYTHON` to select a Python executable. Recipe/license snapshots are
copied from version control; numerical caches are not reused.

`evidence/sources/muse/render-source-panels.py` independently reads the original
FITS arrays, checks every projected TIFF and configured grid, and renders the
three source panels. Run it from the repository root. For the separate Enceladus
calculation, copy `qualify-enceladus.py` into the fresh `vims-chemistry` directory
created above and run that copy. It resolves the pinned recipe beside itself and
checks all supported values plus independent spherical source-cell probes.

## Prepared scene replay

Install dependencies and build packages, renderer and preparation tools using
the repository commands. Restore the existing body source inputs and published
runtime images using the regular acquisition/setup workflow. Then, for each of
`io`, `ganymede` and `enceladus`, run these two commands in separate processes:

```sh
node docs/moons/b8-surface-chemistry/prepare-selected.mts io
node docs/moons/b8-surface-chemistry/finalize-one.mts io
```

The first command uses the standard scientific raster/material/content
preparers, retaining the verified baseline scene and existing photographic
assets. The second writes the canonical object transport. The complete authored
body preparation recipes also include the new views; this incremental replay
avoids regenerating unchanged large imagery and geometry.

`node docs/moons/b8-surface-chemistry/verify-packages.mjs` verifies all three body
packages, source/runtime closure and shared runtime ownership. Scene bytes and
retained runtime trees must match base
`1fb76e44d6bf831e7ebcf0516b83c0b10e1716da` (including the subsequently merged
asteroid navigation-marker update).

## Delivery and browser evidence

`deliver-selected.mjs` inventories the image increment and can publish it with
its explicit publication option. Publication is not part of numerical or browser
reproduction. The retained delivery receipt proves all 134 selected-body images
were downloaded into an empty installation and hash-checked; 20 are new.

```sh
B8_DPR=1 node docs/moons/b8-surface-chemistry/browser-one.mjs io
B8_DPR=2 node docs/moons/b8-surface-chemistry/browser-one.mjs io
```

Repeat for Ganymede and Enceladus, sequentially. Each invocation starts its own
Astro server on port 4291, launches one headless Chrome, and closes both. The
capture freezes body/source/runtime/image/style hashes, uses real dataset
buttons, and exercises prepared focus, both shadow states, legends, information
tabs, drag and zoom without replacing retained nodes. Actual response bytes are
verified against local pins. `B8_LENS` optionally narrows one body to one view.

The existing shared Settings button is hidden on this base. Shadow-state checks
use its existing hidden input binding and explicitly do not prove public
Settings reachability. Captures are actual browser output, not a native-renderer
parity test or a compositor performance measurement.

Heavy commands were run separately through the existing task resource monitor
in `docs/moons/b3-preparation/final/resource-tools/run-bounded.py`; receipts
record measured peak process-tree RSS and system free memory. Use the evidence
index and visual review for completed gates and remaining aggregate limits.
