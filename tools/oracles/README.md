# Oracles

An oracle is a reference implementation that recomputes what the preparation
pipeline computes, so a test can compare the two. The pipeline stays strict
TypeScript and derives nothing from an oracle; the oracle only says whether the
pipeline's result is right. `tools/oracles/comet-19p/` and `tools/oracles/venus/`
are older standalone audits; the groups below are fixture oracles.

| Oracle | Verifies | Script | Comparing test |
| --- | --- | --- | --- |
| SpiceyPy (CSPICE N0067) | `tools/spice/`: leap seconds, TDB, SCLK, SPK states with `NONE`, `LT`, `LT+S`, `CN`, `CN+S`, every frame class, and where the DRACO camera places archived intercepts (read with pds4_tools) | `spice/dart-draco.py` | `tools/spice/oracle.test.mts` |
| pds4_tools | `pds4-geometry-cube.mts`: every label-defined plane of the DART DRACO cube, values, flags and unit conversions | `pds/dart-draco-cube.py` | `pds4-geometry-cube.oracle.test.mts` |
| pvl, numpy | `osiris-geo.mts`: the Rosetta OSIRIS level-5 geometry planes and level-4 quality companion (67P) | `pds3/osiris-geo.py` | `osiris-geo.oracle.test.mts` |
| pvl, numpy | `archived-camera.mts`: the OSIRIS level-4 reflectance, sigma and quality planes (Steins) | `pds3/osiris-reflectance.py` | `archived-camera.oracle.test.mts` |
| pvl, numpy, astropy | `amica-geo.mts`: the Hayabusa AMICA Gaskell DDR cube, detector FITS and flat field (Itokawa) | `pds3/amica-ddr.py` | `amica-geo.oracle.test.mts` |
| astropy | `llorri-geo.mts`: the Lucy L'LORRI HDUs and the TAN-SIP distortion through `astropy.wcs` (Donaldjohanson) | `fits/llorri.py` | `llorri-geo.oracle.test.mts` |
| astropy | `encounter-fits.mts`: Deep Impact ITS (Tempel 1), Stardust NAVCAM (Wild 2) and MRI (Hartley 2) planes, identity and accept or reject counts | `fits/encounter.py` | `encounter-fits.oracle.test.mts` |
| pvl, numpy | `isis2-qube.mts`: the Deep Space 1 MICAS orthographic image and DEM component cubes and their special pixels (Borrelly) | `isis2/borrelly-micas.py` | `isis2-qube.oracle.test.mts` |
| USGS ISIS 10.0.0_LTS unit-test truth files | `tools/photometry/`: Hapke with shadow hiding, Hapke (1984) roughness and both ISIS phase functions, and the Lunar-Lambert, Minnaert and Lommel-Seeliger disk functions | `isis/photometric-truth.py` | `tools/photometry/isis.oracle.test.mts` |

Scripts are under `tools/oracles/`, fixtures under `tests/oracles/` with the
same group and name, and the comparing tests beside the code they check (under
`tools/objects/terrestrial-layers/` unless a path is given).

## Rules

- A fixture is evidence. It records the oracle and interpreter versions and the
  sha256 of every input it read. An input from outside the repository, such as
  another project's test data, is a reference: its URL names a commit, and the
  fixture records its sha256 and size. `tools/oracle-fixtures.test.mts`, part of
  `pnpm test:platform`, refuses a fixture whose tool versions differ from
  `requirements.txt`, whose inputs are not the bodies' manifest pins, or whose
  references are not pinned to a commit. It needs neither Python nor restored
  sources.
- Comparing tests read the committed fixture and the same pinned inputs the
  pipeline reads. They run without Python.
- An oracle reads the archive with its own reader. It may read a recipe's declared
  policy, such as a detector border, but never a value the pipeline computed.
- Regenerate a fixture only when the oracle version or an input changes, and say
  so in the PR. Fixtures are deterministic: the same environment and inputs write
  the same bytes.
- Oracles never write under `src/`; nothing an oracle produces becomes a source,
  a recipe or a prepared file.

## Setup and use

```bash
pnpm oracles:setup
```

creates `.local/oracles/venv` from `tools/oracles/requirements.txt`, which pins
every package, transitive ones included (Python 3.12; set `ORACLE_PYTHON` for
another interpreter). Then regenerate every fixture, or name some:

```bash
pnpm oracles:run
```

```bash
pnpm oracles:run fits/llorri spice/dart-draco
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
