# Oracles

An oracle is a reference implementation that recomputes something the
preparation pipeline computes, so a test can compare the two. The pipeline stays
strict TypeScript and derives nothing from an oracle; the oracle only says
whether the pipeline's result is right. `tools/oracles/comet-19p/` and
`tools/oracles/venus/` were the first; this directory now holds shared ones.

| Oracle | Verifies | Script | Fixture |
| --- | --- | --- | --- |
| SpiceyPy (CSPICE) | `tools/spice/`: leap seconds, TDB, SCLK, SPK states with `NONE`, `LT`, `LT+S`, `CN`, `CN+S`, every frame class, and the DRACO camera's placement of archived intercepts | `tools/oracles/spice/dart-draco.py` | `tests/oracles/spice/dart-draco.json`, compared by `tools/spice/oracle.test.mts` |
| pds4_tools (NASA PDS) | `pds4-geometry-cube.mts`: every label-defined plane of the DRACO cube, values, flags and unit conversions | `tools/oracles/pds/dart-draco-cube.py` | `tests/oracles/pds/dart-draco-cube.json`, compared by `tools/objects/terrestrial-layers/pds4-geometry-cube.oracle.test.mts` |

## Rules

- A fixture is evidence. It records the oracle's version, the interpreter, and
  the sha256 of every input it read; the comparing test refuses a fixture whose
  inputs are not the pinned ones.
- Regenerate a fixture only when the oracle version or the inputs change, and
  say so in the PR. A changed fixture with unchanged inputs means the oracle
  changed, which is worth a sentence.
- Comparing tests run without Python: they read the committed fixture and the
  same pinned inputs the pipeline reads.
- Oracles never write under `src/`; nothing an oracle produces becomes a
  source, a recipe or a prepared file.

## Setup and use

```bash
pnpm oracles:setup
```

creates `.local/oracles/venv` from `tools/oracles/requirements.txt` (Python 3.12;
set `ORACLE_PYTHON` to another interpreter). Then, for example:

```bash
pnpm oracle:spice-dart
pnpm oracle:pds-dart
```

`oracle:spice-dart` needs the archived DRACO intercepts as points; it takes the
JSON written by `tools/oracles/spice/dart-draco-points.mts`, which the script
invokes for you.

## Next oracles

- USGS ALE and usgscsm for instrument pixel models and distortion: ALE builds
  only inside conda, so it arrives with the first Cassini ISS lens and a pinned
  conda environment file.
- ISIS `photomet` for the photometric normalization step.
