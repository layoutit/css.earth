# Oracles

An oracle is a reference implementation that recomputes what the preparation
pipeline computes, so a test can compare the two. The pipeline stays strict
TypeScript and derives nothing from an oracle; the oracle only says whether the
pipeline's result is right. `packages/bake/src/objects/layers/terrestrial/registration/fixtures/comet-19p/`
is an older standalone audit; the groups below are fixture oracles.

| Oracle | Verifies | Script | Comparing test |
| --- | --- | --- | --- |
| Astropy ICRS geometry, NumPy vectors | The declared circular hosted-orbit contract: sky frames, phase/state vectors, and the synchronous body orientation derived from them (not physical ephemeris accuracy) | `packages/bake/src/objects/scene/fixtures/hosted-orbit.py` | `packages/bake/src/objects/scene/hosted-orbit.oracle.test.mts` |
| SpiceyPy (CSPICE N0067) | Eccentric hosted-orbit position and velocity, including a sourced TRAPPIST-1f convention conversion; both implementations receive the same representable BMJD_TDB timestamp | `packages/bake/src/astronomy/fixtures/hosted-eccentric.py` | `packages/bake/src/astronomy/hosted-eccentric.oracle.test.mts` |
| Astropy blackbody, constants and units | Frequency-form Planck intensity and brightness-temperature inversion used by ALMA preparation, plus the HST flux-density-to-Rayleigh conversion | `packages/telescope-cli/src/archives/interferometry/fixtures/oracles/physical-units/spectral.py` | `packages/telescope-cli/src/archives/interferometry/spectral-units.oracle.test.mts` |
| NumPy SVD, following pinned ThERESA source | `eigenmap-fit.mts`: signed harmonic curves, scale-independent eigencurve ordering, eigenmap coefficients and rejection of the null spectrum; comparisons are invariant to arbitrary eigenvector signs | `packages/bake/src/objects/raster/eclipse-map/fixtures/theresa-eigenbasis.py` | `packages/bake/src/objects/raster/eclipse-map/eigenmap-fit.oracle.test.mts` |
| NumPy, Astropy, following pinned ThERESA source | Eclipse-map harmonic normalization and signs, weighted linear fit and posterior covariance, Planck radiance and single/band brightness temperatures | `packages/bake/src/objects/raster/eclipse-map/fixtures/numerics.py` | `packages/bake/src/objects/raster/eclipse-map/numerics.oracle.test.mts` |
| [Native SBMT](../../../../bake/src/objects/layers/terrestrial/fixtures/sbmt/README.md) | SUM/INFO pointing, PDS vertex-facet geometry, visibility, FITS samples and image-to-mesh UV projection; differences remain explicit | `packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/projection.mts` | `packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/projection.test.mts` |
| SpiceyPy (CSPICE N0067) | `@cssearth/spice`: leap seconds, TDB, SCLK, SPK states with `NONE`, `LT`, `LT+S`, `CN`, `CN+S`, every frame class, and where the DRACO camera places archived intercepts (read with pds4_tools) | `packages/bake/src/objects/cameras/fixtures/dart-draco.py` | `packages/bake/src/objects/cameras/dart-draco.oracle.test.mts`, and `packages/bake/src/astronomy/fixtures/small-kernel.oracle.test.mts` for the LSK and PCK alone |
| SpiceyPy (CSPICE N0067) | `@cssearth/spice` `spacecraftApproach`: New Horizons' closest approaches to Pluto and Charon and the side of each it approached, in the IAU body frame | `packages/bake/src/objects/default-view/fixtures/new-horizons-approach.py` | `packages/bake/src/objects/default-view/fixtures/new-horizons-approach.oracle.test.mts` |
| pds4_tools | `pds4-geometry-cube.mts`: every label-defined plane of the DART DRACO cube, values, flags and unit conversions | `packages/bake/src/objects/layers/terrestrial/missions/dart-draco-cube.py` | `pds4-geometry-cube.oracle.test.mts` |
| pvl, numpy | `osiris-geo.mts`: the Rosetta OSIRIS level-5 geometry planes and level-4 quality companion (67P) | `packages/bake/src/objects/layers/terrestrial/missions/osiris-geo.py` | `osiris-geo.oracle.test.mts` |
| pvl, numpy | `archived-camera.mts`: the OSIRIS level-4 reflectance, sigma and quality planes (Steins) | `packages/bake/src/objects/layers/terrestrial/missions/osiris-reflectance.py` | `archived-camera.oracle.test.mts` |
| pvl, numpy, astropy | `amica-geo.mts`: the Hayabusa AMICA Gaskell DDR cube, detector FITS and flat field (Itokawa) | `packages/bake/src/objects/layers/terrestrial/missions/amica-ddr.py` | `amica-geo.oracle.test.mts` |
| astropy | `llorri-geo.mts`: the Lucy L'LORRI HDUs and the TAN-SIP distortion through `astropy.wcs` (Donaldjohanson) | `packages/bake/src/objects/layers/terrestrial/missions/llorri.py` | `llorri-geo.oracle.test.mts` |
| astropy | `encounter-fits.mts`: Deep Impact ITS (Tempel 1), Stardust NAVCAM (Wild 2) and MRI (Hartley 2) planes, identity and accept or reject counts | `packages/bake/src/objects/layers/terrestrial/missions/encounter.py` | `encounter-fits.oracle.test.mts` |
| astropy | Shared FITS numeric decoding, scaling, missing values, cube planes, image extensions and CONTINUE long strings | `packages/bake/src/objects/cameras/fixtures/fits/core.py` | `packages/bake/src/objects/cameras/core.oracle.test.mts` |
| astropy | `@cssearth/fits` `readRiceCompressedImage`: RICE_1 tile-compressed images (8-, 16- and 32-bit; constant, small-difference and directly coded blocks; JSOC's BSCALE, BZERO and table BLANK) and `hmi-continuum.mts` HMI pixels under CROTA2 through `astropy.wcs` | `packages/bake/src/objects/layers/observation/fixtures/fits/rice.py` | `packages/bake/src/objects/layers/observation/fixtures/fits/rice.oracle.test.mts` |
| astropy | `observation/wise-atlas-mosaic.mts`: AllWISE atlas SIN tile pixels to the hips2fits-convention TAN grid, near the centre and at a 24° field corner | `packages/bake/src/objects/raster/fixtures/wise-atlas-projection.py` | `packages/bake/src/objects/raster/wise-atlas-mosaic.oracle.test.mts` |
| astropy | `@cssearth/fits` `skyImageAxes` and `skyDisplayRaster`: which way RA and Dec run along columns and rows at the reference pixel (CDELT, CD, PC and CROTA2; linear and zenithal axes; SQUEEZE, hips2fits and ZIMPOL headers), the north-up east-left display raster, and refusal of rotated or skewed images | `packages/bake/src/objects/cameras/fixtures/fits/sky-orientation.py` | `packages/bake/src/objects/cameras/sky-orientation.oracle.test.mts` |
| astropy | `@cssearth/fits` `skyProjection` and `@cssearth/fits/node` `readFitsFileRegion`: pixel to ICRS and back for rotated, skewed and near-pole TAN headers, including a JWST NIRCam level-3 mosaic's WCS; refusal of SIP, TPV, SIN and FK4; one image region read from disk | `packages/bake/src/objects/cameras/fixtures/fits/sky-projection.py` | `packages/bake/src/objects/cameras/sky-projection.oracle.test.mts` |
| astropy | `packages/bake/src/objects/raster/fits/fits-table.ts`: every OIFITS column type including complex C and M, TNULL read as NaN, HIERARCH keys, and refusal of TSCAL/TZERO-scaled columns | `packages/telescope-cli/src/archives/interferometry/fixtures/oracles/fits/binary-table.py` | `packages/telescope-cli/src/archives/interferometry/fits-table.oracle.test.mts` |
| astropy | `color-transfer.ts` (`@cssearth/bake/objects/color`) asinh band display: every byte of `make_lupton_rgb` (Lupton et al. 2004) for colour and one-band cases | `packages/bake/src/objects/color/fixtures/lupton-asinh.py` | `packages/bake/src/objects/color/color-transfer.oracle.test.mts` |
| astropy | Every ESO HIERARCH value and every pixel of four released Pallas SPHERE images; no camera or surface qualification | `packages/bake/src/objects/cameras/fixtures/fits/pallas.py` | `packages/bake/src/objects/cameras/pallas.test.mts` |
| astropy | Sun synoptic and Jupiter HST/OPAL images, including archived header conventions | `packages/bake/src/objects/cameras/fixtures/fits/synoptic.py` | `packages/bake/src/objects/cameras/synoptic.test.mts` |
| astropy, numpy | `observation/spectral-band-maps.mts`: Charon LEISA spectra, per-pixel wavelengths, archived coordinates and ice-band estimators near Organa | `packages/bake/src/objects/layers/terrestrial/missions/charon-leisa.py` | `packages/bake/src/objects/layers/observation/spectral-band-maps.test.mts` |
| pvl, numpy | `isis2-qube.mts`: the Deep Space 1 MICAS orthographic image and DEM component cubes and their special pixels (Borrelly) | `packages/bake/src/objects/layers/terrestrial/missions/borrelly-micas.py` | `isis2-qube.oracle.test.mts` |
| numpy | `npy-lonlat-grid.mts`: the `.npy` arrays of the Cambioni et al. (2022) ALMA maps of Psyche and nearest-node lookup, including both half-cells at the antimeridian | `packages/bake/src/objects/raster/numpy/psyche-alma.py` | `npy-lonlat-grid.oracle.test.mts` |
| USGS ISIS 10.0.0_LTS unit-test truth files | `packages/bake/src/photometry/`: Hapke with shadow hiding, Hapke (1984) roughness and both ISIS phase functions, and the Lunar-Lambert, Minnaert and Lommel-Seeliger disk functions | `packages/bake/src/photometry/fixtures/photometric-truth.py` | `packages/bake/src/photometry/isis.oracle.test.mts` |

Script paths in the table are repository-relative and live with their owning packages. The moved mission scripts and comparing tests are in
`packages/bake/src/objects/layers/terrestrial/missions/`; NumPy surface cases are in
`packages/bake/src/objects/raster/numpy/`, circular hosted-orbit fixtures in
`packages/bake/src/objects/scene/fixtures/`, and ISIS photometric fixtures in
`packages/bake/src/photometry/fixtures/`. The source-surface test, fixture and Python
verifier are in `packages/bake/src/objects/geometry/`.

Only the two test runners and their tsconfig remain under `tests/oracles/`. Bake-owned FITS records and
eclipse-map cases live beside their comparing bake suites. SBMT lives in
`packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/`. Historical `generatedBy` strings
keep the generator’s original path. `tests/oracles/tsconfig.json` includes the relocated scripts.

The SBMT fixture's tool record names the SBMT, release, Java and java-bridge versions only.
The shared FITS reader is the
`@cssearth/fits` package, whose own tests stay self-contained, so its comparing tests sit beside
their scripts in `packages/bake/src/objects/cameras/`. The SPICE reader is the `@cssearth/spice` package, and its comparing tests
span `packages/bake/src/objects/cameras/`, `packages/bake/src/astronomy/fixtures/` and
`packages/bake/src/objects/default-view/fixtures/`; the fixtures follow their comparing tests.

## Rules

- A fixture is evidence. Its current envelope records oracle/interpreter
  versions, input paths and byte counts. External references name a commit in
  their URL and record a size. Body inputs must appear in their manifest; the shared reader
  also accepts the declared FITS, SBMT and hosted-orbit test fixtures. A source-dependent
  skip is not a completed fixture audit.
- Comparing tests read the committed fixture and the same declared inputs the
  pipeline reads. They run without Python. `readOracleInput` checks the recorded
  byte count immediately before comparison. Git identifies tracked inputs and the
  R2 source mirror identifies restored downloads, so fixtures record no digests.
- An oracle reads the archive with its own reader. It may read a recipe's declared
  policy, such as a detector border, but never a value the pipeline computed.
- Regenerate a fixture only when the oracle version or an input changes, and say
  so in the PR. Fixtures are deterministic: the same environment and inputs write
  the same bytes.
- Oracles write only reference fixtures in their owner directories (including
  the moved fixtures under `packages/bake/src/`) or audit reports under `output/`;
  nothing an oracle produces becomes a body source, recipe or prepared file.

## Setup and use

SBMT is an opt-in native backend: `node packages/core/src/node/oracle/setup.mts sbmt`, then
`node packages/core/src/node/oracle/run.mts sbmt/projection`. It uses the same fixture envelope with a
pinned executable/software lock that names each file's path and size. `node tests/oracles/test-sbmt.mts --unit`
runs offline in CI; `node tests/oracles/test-sbmt.mts --restore` restores only its selected inputs
and runs all cases. See its [coverage and known differences](../../../../bake/src/objects/layers/terrestrial/fixtures/sbmt/README.md).
The commands below operate on the Python backends.

```bash
node packages/core/src/node/oracle/setup.mts
```

creates `.local/oracles/venv` from `packages/core/src/node/oracle/requirements.txt`, which pins
every package, transitive ones included (Python 3.12; set `ORACLE_PYTHON` for
another interpreter). Then regenerate every fixture, or name some:

```bash
node packages/core/src/node/oracle/run.mts
```

```bash
node packages/core/src/node/oracle/run.mts fits/llorri spice/dart-draco
```

The inputs must be restored first (`node packages/bake/cli/object-operations.mts acquire <id>`).
`isis/photometric-truth` reads no body input; it downloads the ISIS truth files
at the pinned commit, so it needs network access.

## Known reader quirks

- `astropy.wcs.WCS.sip_pix2foc` with origin 0 also subtracts one from its output,
  which is already relative to `CRPIX`; the L'LORRI oracle evaluates in the FITS
  1-based convention.
- pvl parses PDS3 dates into datetimes; the oracles write them back as label text.
- pdr cannot read PDS4 array planes stored at byte offsets in one FITS file;
  pds4_tools can.
- ISIS's photometric unit tests print some parameter sets twice, once set by
  keyword and once by setter; the ISIS oracle keeps each case once.
- ISIS returns 0 at exactly 90° incidence or emission. Converting degrees as
  angle × π / 180, in that order, keeps 90° exactly π/2 in the comparing test.

## Next oracles

- USGS ALE and usgscsm for instrument pixel models and distortion: ALE builds only
  inside conda and has no DART driver, so it arrives with the first Cassini ISS
  lens and a pinned conda environment file.
- ISIS `photomet` on cubes, for normalization grids beyond the unit-test
  geometries. It needs an ISIS install through conda.

T2c keeps historical fixture names and input records unchanged. The core reader and Python writer resolve moved records to bake-owned paths; the remaining FITS generators stay under [`tests/oracles/fits/`](https://github.com/layoutit/cssEarth/tree/a2a7f5376d90db90bf79ecf2e95070fd474faf48/tests/oracles/fits/) (now `packages/bake/src/objects/cameras/fixtures/fits/`).
