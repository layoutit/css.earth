# Cassini infrared and ice surfaces

B9 adds **Infrared** and **Ice absorption** to Tethys, Iapetus and Phoebe through
the existing object contract. The six views use measured Cassini VIMS spectra.
Existing meshes, scene trees, camera/navigation, shell and renderer stay fixed.
The original image assets remain byte-identical.

## What the colors mean

Infrared assigns channels near 2.02, 1.59 and 1.28 µm to RGB. It is false color,
with a common per-body range and gamma 2.2. Ice absorption is the native near 2.02 µm
reflectance divided by the linearly interpolated 1.82–2.20 µm continuum, subtracted
from 1. Exact wavelengths are pinned per observation. Neither view measures ice
abundance. Source illumination, viewing angle, grain size, archive filtering and
noise remain; no photometric correction or cross-observation normalization is
applied. Numeric source values remain float32; only display colors are clipped.

| Body | Selected observations | Infrared coverage | Ice coverage | Key limit |
| --- | ---: | ---: | ---: | --- |
| Tethys | 9; 7 supply infrared | about 14.8% | about 22.6% | Separate USGS brightness comparison is non-diagnostic for absolute alignment. |
| Iapetus | 3 | about 23.4% | about 23.4% | USGS comparison supports gross framing, not precise local registration. |
| Phoebe | 1; 41 accepted native pixels | about 1.84% | about 1.84% | Fitted coarse regional registration; the second observation fails holdouts. |

Coverage is the union of supported output-grid directions weighted by reference
sphere solid angle, **not measured physical mesh area**. Native scan gaps remain
missing. Denser output grids do not create observation detail. Infrared display
packing uses the established photographic bilinear/WebP path, so boundaries can
soften within a small texture neighborhood; exact scientific mask-edge parity is
not claimed for that display. The numerical owner rasters, calibrated I/F values
and derived float32 indices are lossless. Ice absorption uses the existing
nearest-sampled scalar path.

## Source and independent review

- [Source maps](source-review/source-maps.png) and [their pinned inputs](source-review/source-maps.json).
- [Tethys](source-review/tethys.md), [raw detector quality](source-review/tethys/DETECTOR-QUALITY.md), [regional framing](source-review/tethys/REGIONAL-FRAMING.md).
- [Iapetus](source-review/iapetus.md), [detector aperture audit](source-review/iapetus/rasterizer-review.md), [USGS framing](source-review/iapetus/iss-framing.md).
- [Phoebe](source-review/phoebe.md), [independent final mesh mapping](source-review/iapetus/phoebe-fixed-map-review.md).

Nantes finite calibrated values alone do not prove unsaturated detectors. The
new original-QUB check reconstructs ADC values using each source line's original
background, excludes specials/clipping and source-filter dependencies, and binds
the matching calibrated cube. Historical ISIS code supports withholding a
missing Iapetus background row and its local dependencies rather than discarding
the usable observation.

The source camera uses original timing, cached rotations/positions and qualified
nominal IR apertures. Dense independent tests challenge output bounds, scan gaps
and between-pose motion. Phoebe additionally transfers the source frame, fits
look offsets with untouched limb checks, and tests closest mesh visibility,
illumination, self-shadow and radial ambiguity on its unchanged mesh. These are
sampled physical-support checks, not an integrated PSF or exact absolute pointing
claim. The failed Phoebe 0650 observation remains documented and withheld.

## Reproduce the source maps

Run from the repository root with Python 3.12, NumPy 2.3.5 and Rasterio 1.4.4.
The original C/N cubes, QUBs, recipes, evidence, lossless derived TIFFs and owner
companions are checked in beside each body under `source/cassini-ice`. The
normal acquisition plan also restores original archive inputs from pinned URLs.
No source download is needed to repeat these conversions. For an independent
fresh-directory replay that seeds only pinned originals and compares all 21
output TIFFs byte for byte, run
`python3 docs/moons/b9-cassini-ice-surfaces/reproduce-sources.py` with that
scientific Python environment. The individual converter commands are:

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 tools/objects/acquisition/cassini-ice-surfaces.py src/planets/tethys/source/cassini-ice/prepare.json
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 tools/objects/acquisition/cassini-ice-surfaces.py src/planets/iapetus/source/cassini-ice/prepare.json
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 tools/objects/acquisition/cassini-phoebe-surfaces.py src/planets/phoebe/source/cassini-ice/prepare.json
python3 -m unittest discover -s tools/objects/acquisition -p 'test_cassini*.py'
```

Run numerical and preparation jobs serially. The final grids are 1024×512 for
Tethys/Iapetus and 1440×720 for Phoebe. Phoebe's historical 720×360 source trial is
retained as review history; the final grid fits the unchanged 16-band atlas.
`stage-body-source.py` and the trial intake scripts describe the original work
staging; they are not required to reproduce the checked-in final source maps.
`materialize-review-inputs.py` restores the historical selected-cube review paths
from the checked-in body originals. Duplicate selected QUBs and Python caches are
ignored; the separately rejected Phoebe 0650 QUB remains in the review record.

## Prepare existing materials

Build the repository's packages, renderer and preparation tools. Restore the
selected bodies' baseline source inputs and published runtime images using the
normal acquisition/setup tools. In separate serial processes, run for each of
`tethys`, `iapetus` and `phoebe`:

```sh
node docs/moons/b9-cassini-ice-surfaces/prepare-selected.mjs tethys
node docs/moons/b9-cassini-ice-surfaces/finalize-one.mjs tethys
```

The replay uses standard material, scalar, image, pole, thumbnail, minimap and
provenance preparers with the saved scene and mesh. Exact frozen scene/terrain
checks run before and after preparation. `finalize-source-manifests.py` refreshes
pins after deliberate authored/source changes; do not use it to accept unexplained
original-input drift. `verify-packages.mjs` checks package/source/runtime closure,
retained scene identity and shared ownership, recording existing baseline audit
failures separately.

`browser-one.mjs` mounts one body in a task-owned server and closes the browser
and server after the capture. `B9_DPR=1` or `B9_DPR=2` selects the device ratio.
Set `B9_LENS=normal`, `infrared` or `ice-absorption` to capture one view per process
and keep browser memory bounded.
`deliver-selected.mjs` measures the exact image increment; its explicit publish
mode uses the existing content-addressed image delivery and verifies a fresh
installation. Browser and delivery evidence is collected separately from source
review. No deployment or merge is implied by local preparation.
