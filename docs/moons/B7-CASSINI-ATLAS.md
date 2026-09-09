# B7: Cassini surface atlas

Five scientific views deepen three existing moons through the current object
contract. Branch `feat/moons-cassini-atlas` starts at merged B6 main
`34da5b07d96fd53e2d1a9877db470c04a58dea2f`.

| Body | New views | Original source and meaning |
| --- | --- | --- |
| Titan | Geology | Six geomorphic units from the authors' original global shapefiles, release DOI 10.17632/f6jrtyfp66.2, CC BY 4.0. Interpreted mapping combines Cassini radar and infrared. |
| Dione | Infrared; ice absorption | Scipioni/Combe's unweighted, photometrically corrected Cassini VIMS spectral mosaic. False-color RGB and a derived 2.02 µm continuum-relative absorption strength. |
| Rhea | Infrared; ice absorption | The same released VIMS product family, wavelengths and display ranges as Dione. |

The [source review](b7-cassini-atlas/evidence/source/SOURCE-REVIEW.md) records
independent original-byte and polygon checks. [VIMS interpretation](b7-cassini-atlas/VIMS-INTERPRETATION.md)
records the precise wavelength formula, native validity, source-label conflicts,
registration evidence and alternative-product survey. Each body owns its source
manifest, recipes, credits, derived TIFFs and explanatory content.

## Preparation and scope

No renderer, runtime, shared shell, navigation, camera or geometry changes.
Titan retains its existing sphere scene. Dione and Rhea retain their existing
2,000-face meshes, CSS matrices, background coordinates and runtime trees.
Existing lens assets retain their exact bytes. Default views stay as they were.

Offline preparation now accepts multiple original geology shapefiles, explicit
nearest sampling of georeferenced masked observations, and reduced radial atlas
images. A new 256×2000 image addresses the same Dione/Rhea faces as the canonical
2048×16000 CSS background; source cells remain coarse. There is no runtime
reprojection, mesh generation, image processing or new chart/UI capability.

The five views add **17 runtime images / 1,873,728 bytes** in total: Titan
114,834 bytes, Dione 921,358 bytes and Rhea 837,536 bytes. This is incremental
image delivery, not total scene download, decoded memory or measured frame rate.
Existing body inventories are about 33–41 MB each. Prepared image residency
remains fixed at mount and independent of DPR.

## Scientific limits

- Titan's classes are interpreted terrain, not elevation, age or composition
  fractions. Lakes/basins includes areas formerly occupied by liquid. The
  2048×1024 display grid retains holes and withholds 495 conflicting cells;
  815 cells are missing overall. These are grid counts, not area percentages.
- VIMS RGB is false color at 2.00141, 1.57321 and 1.06495 µm. Missing native
  samples remain gaps; valid dark measurements remain observed.
- Water-ice absorption uses a linear continuum around the 2.01788 µm band.
  It is not ice abundance, grain size or crystallinity. Fixed display ranges
  are shared across Dione and Rhea.
- The archive guide describes one-degree bins, but its projected metadata
  conflicts at source-pixel scale. Global orientation has independent ISS
  support; alignment within one source pixel remains uncertain. The intermediate
  map also quantizes boundaries by up to about 0.176°.

## Reproduce and qualify

Normal users install prepared assets through the existing setup protocol.
Scientific source processing is offline. Install the pinned packages in
`tools/objects/acquisition/requirements-mapped-science.txt` in a Python environment.
Keep numerical threads at one. Run from the repository root, one command at a time:

```sh
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
node tools/restore-source-inputs.mjs --object=titan --object=dione --object=rhea
python tools/objects/acquisition/geology-grid.py src/planets/titan/source/geology/prepare-grid.json
python tools/objects/acquisition/cassini-vims.py src/planets/dione/source/vims/prepare-maps.json
python tools/objects/acquisition/cassini-vims.py src/planets/rhea/source/vims/prepare-maps.json
```

The checked-in compact TIFFs are reproducible from pinned original releases.
The selected source restoration/reproduction check uses a fresh destination:
`node docs/moons/b7-cassini-atlas/restore-and-reproduce.mjs`; set `B7_PYTHON` if
the scientific environment uses a different Python executable.

For incremental material replay, run `prepare-selected.mjs BODY` followed by
`finalize-one.mjs BODY` from `docs/moons/b7-cassini-atlas/`, separately for each
of the three bodies after building the preparation package. These scripts use
the existing material/content/runtime owners and preserve the verified baseline
scene. The ordinary authored preparation recipe also contains the complete views.

The [visual and qualification report](b7-cassini-atlas/VISUAL-REVIEW.md) separates
selected-body results from full-repository gates and records current-main
limitations. B4 charts remain paused in draft PR #70. This batch adds no body
to the frozen moon coverage denominator.
