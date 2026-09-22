# Oracles

An oracle is a reference implementation that recomputes what the preparation
pipeline computes, so a test can compare the two. The pipeline stays strict
TypeScript and derives nothing from an oracle; the oracle only says whether the
pipeline's result is right. `tools/oracles/comet-19p/` and `tools/oracles/venus/`
are older standalone audits; the groups below are fixture oracles.

| Oracle | Verifies | Script | Comparing test |
| --- | --- | --- | --- |
| Astropy ICRS geometry, NumPy vectors | The declared circular hosted-orbit contract: sky frames, phase/state vectors, and the synchronous body orientation derived from them (not physical ephemeris accuracy) | `astronomy/hosted-orbit.py` | `tools/objects/hosted-orbit.oracle.test.mts` |
| SpiceyPy (CSPICE N0067) | Eccentric hosted-orbit position and velocity, including a sourced TRAPPIST-1f convention conversion; both implementations receive the same representable BMJD_TDB timestamp | `astronomy/hosted-eccentric.py` | `tools/objects/hosted-eccentric.oracle.test.mts` |
| Astropy blackbody, constants and units | Frequency-form Planck intensity and brightness-temperature inversion used by ALMA preparation, plus the HST flux-density-to-Rayleigh conversion | `physical-units/spectral.py` | `tools/objects/spectral-units.oracle.test.mts` |
| NumPy SVD, following pinned ThERESA source | `eigenmap-fit.mts`: signed harmonic curves, scale-independent eigencurve ordering, eigenmap coefficients and rejection of the null spectrum; comparisons are invariant to arbitrary eigenvector signs | `eclipse-map/theresa-eigenbasis.py` | `tools/objects/eclipse-map/eigenmap-fit.oracle.test.mts` |
| NumPy, Astropy, following pinned ThERESA source | Eclipse-map harmonic normalization and signs, weighted linear fit and posterior covariance, Planck radiance and single/band brightness temperatures | `eclipse-map/numerics.py` | `tools/objects/eclipse-map/numerics.oracle.test.mts` |
| [Native SBMT](sbmt/README.md) | SUM/INFO pointing, PDS vertex-facet geometry, visibility, FITS samples and image-to-mesh UV projection; differences remain explicit | `sbmt/projection.mts` | `sbmt/projection.test.mts` |
| SpiceyPy (CSPICE N0067) | `tools/spice/`: leap seconds, TDB, SCLK, SPK states with `NONE`, `LT`, `LT+S`, `CN`, `CN+S`, every frame class, and where the DRACO camera places archived intercepts (read with pds4_tools) | `spice/dart-draco.py` | `tools/spice/oracle.test.mts` |
| pds4_tools | `pds4-geometry-cube.mts`: every label-defined plane of the DART DRACO cube, values, flags and unit conversions | `pds/dart-draco-cube.py` | `pds4-geometry-cube.oracle.test.mts` |
| pvl, numpy | `osiris-geo.mts`: the Rosetta OSIRIS level-5 geometry planes and level-4 quality companion (67P) | `pds3/osiris-geo.py` | `osiris-geo.oracle.test.mts` |
| pvl, numpy | `archived-camera.mts`: the OSIRIS level-4 reflectance, sigma and quality planes (Steins) | `pds3/osiris-reflectance.py` | `archived-camera.oracle.test.mts` |
| pvl, numpy, astropy | `amica-geo.mts`: the Hayabusa AMICA Gaskell DDR cube, detector FITS and flat field (Itokawa) | `pds3/amica-ddr.py` | `amica-geo.oracle.test.mts` |
| astropy | `llorri-geo.mts`: the Lucy L'LORRI HDUs and the TAN-SIP distortion through `astropy.wcs` (Donaldjohanson) | `fits/llorri.py` | `llorri-geo.oracle.test.mts` |
| astropy | `encounter-fits.mts`: Deep Impact ITS (Tempel 1), Stardust NAVCAM (Wild 2) and MRI (Hartley 2) planes, identity and accept or reject counts | `fits/encounter.py` | `encounter-fits.oracle.test.mts` |
| astropy | Shared FITS numeric decoding, scaling, missing values, cube planes, image extensions and CONTINUE long strings | `fits/core.py` | `tools/fits/fits.oracle.test.mts` |
| astropy | `fits-rice.mts`: RICE_1 tile-compressed images (8-, 16- and 32-bit; constant, small-difference and directly coded blocks; JSOC's BSCALE, BZERO and table BLANK) and `hmi-continuum.mts` HMI pixels under CROTA2 through `astropy.wcs` | `fits/rice.py` | `tools/fits/fits-rice.oracle.test.mts` |
| astropy | `observation/wise-atlas-mosaic.mts`: AllWISE atlas SIN tile pixels to the hips2fits-convention TAN grid, near the centre and at a 24° field corner | `fits/wise-atlas-projection.py` | `observation/wise-atlas-mosaic.oracle.test.mts` |
| astropy | `fits-sky.mts`: which way RA and Dec run along columns and rows at the reference pixel (CDELT, CD, PC and CROTA2; linear and zenithal axes; SQUEEZE, hips2fits and ZIMPOL headers), the north-up east-left display raster, and refusal of rotated or skewed images | `fits/sky-orientation.py` | `tools/fits/fits-sky.oracle.test.mts` |
| astropy | `fits-sky.mts` `skyProjection` and `fits.mts` `readFitsFileRegion`: pixel to ICRS and back for rotated, skewed and near-pole TAN headers, including a JWST NIRCam level-3 mosaic's WCS; refusal of SIP, TPV, SIN and FK4; one image region read from disk | `fits/sky-projection.py` | `tools/fits/fits-sky-projection.oracle.test.mts` |
| astropy | `interferometry/fits-table.mts`: every OIFITS column type including complex C and M, TNULL read as NaN, HIERARCH keys, and refusal of TSCAL/TZERO-scaled columns | `fits/binary-table.py` | `interferometry/fits-table.oracle.test.mts` |
| astropy | `color-transfer.mts` asinh band display: every byte of `make_lupton_rgb` (Lupton et al. 2004) for colour and one-band cases | `fits/lupton-asinh.py` | `tools/objects/color-transfer.oracle.test.mts` |
| astropy | Every ESO HIERARCH value and every pixel of four released Pallas SPHERE images; no camera or surface qualification | `fits/pallas.py` | `tools/fits/fits-pallas.test.mts` |
| astropy | Sun synoptic and Jupiter HST/OPAL images, including archived header conventions | `fits/synoptic.py` | `tools/fits/fits-products.test.mts` |
| astropy, numpy | `observation/spectral-band-maps.mts`: Charon LEISA spectra, per-pixel wavelengths, archived coordinates and ice-band estimators near Organa | `fits/charon-leisa.py` | `observation/spectral-band-maps.test.mts` |
| pvl, numpy | `isis2-qube.mts`: the Deep Space 1 MICAS orthographic image and DEM component cubes and their special pixels (Borrelly) | `isis2/borrelly-micas.py` | `isis2-qube.oracle.test.mts` |
| numpy | `npy-lonlat-grid.mts`: the `.npy` arrays of the Cambioni et al. (2022) ALMA maps of Psyche and nearest-node lookup, including both half-cells at the antimeridian | `npy/psyche-alma.py` | `npy-lonlat-grid.oracle.test.mts` |
| USGS ISIS 10.0.0_LTS unit-test truth files | `tools/photometry/`: Hapke with shadow hiding, Hapke (1984) roughness and both ISIS phase functions, and the Lunar-Lambert, Minnaert and Lommel-Seeliger disk functions | `isis/photometric-truth.py` | `tools/photometry/isis.oracle.test.mts` |

Scripts are under `tools/oracles/`, fixtures under `tests/oracles/` with the
same group and name, and the comparing tests beside the code they check (under
`tools/objects/terrestrial-layers/` unless a path is given).

## Rules

- A fixture is evidence. It records the oracle and interpreter versions and the
  sha256 of every input it read. An input from outside the repository, such as
  another project's test data, is a reference: its URL names a commit, and the
  fixture records its sha256 and size. `tools/contract/oracle-fixtures.test.mts`, part of
  `pnpm test:platform`, refuses a fixture whose tool versions differ from
  `requirements.txt`, whose inputs are not the bodies' manifest input/document pins
  or the hashed checked-in test files and test-only archive acquisition record
  under `tests/fixtures/fits/` and hosted-orbit qualification records under
  `tests/fixtures/hosted-orbits/`, or whose
  references are not pinned to a commit. It needs neither Python nor restored
  sources.
- Comparing tests read the committed fixture and the same pinned inputs the
  pipeline reads. They run without Python.
  `readOracleInput` checks the actual bytes and SHA-256 immediately before a FITS
  comparison; matching a fixture to a manifest declaration alone is not that check.
- An oracle reads the archive with its own reader. It may read a recipe's declared
  policy, such as a detector border, but never a value the pipeline computed.
- Regenerate a fixture only when the oracle version or an input changes, and say
  so in the PR. Fixtures are deterministic: the same environment and inputs write
  the same bytes.
- Oracles never write under `src/`; nothing an oracle produces becomes a source,
  a recipe or a prepared file.

## Setup and use

SBMT is an opt-in native backend: `node tools/oracles/setup.mts sbmt`, then
`node tools/oracles/run.mts sbmt/projection`. It uses the same fixture envelope with a
pinned executable/software lock and generator digest. `pnpm test:sbmt --unit`
runs offline in CI; `pnpm test:sbmt --restore` restores only its selected inputs
and runs all cases. See its [coverage and known differences](sbmt/README.md).
The commands below operate on the Python backends.

```bash
node tools/oracles/setup.mts
```

creates `.local/oracles/venv` from `tools/oracles/requirements.txt`, which pins
every package, transitive ones included (Python 3.12; set `ORACLE_PYTHON` for
another interpreter). Then regenerate every fixture, or name some:

```bash
node tools/oracles/run.mts
```

```bash
node tools/oracles/run.mts fits/llorri spice/dart-draco
```

The inputs must be restored first (`node tools/objects/dist/operations.js acquire <id>`).
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
