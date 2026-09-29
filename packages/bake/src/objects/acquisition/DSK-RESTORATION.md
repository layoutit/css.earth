# Reproducible DSK source restoration

The converter requires Python 3.12, SpiceyPy 6.0.3 (CSPICE N0067) and NumPy 2.3.5. `dsk-requirements.txt` pins those two exact releases, and `--only-binary=:all:` lets pip select the supported platform wheel while refusing source builds. `dsk-python-wheels.json` retains the primary PyPI filenames and URLs. The converter checks the SpiceyPy and CSPICE runtime versions before reading source geometry. The qualified host uses Python 3.12; install a local environment from that interpreter:

```sh
python3.12 -m venv .local/dsk-python
.local/dsk-python/bin/python -m pip install --only-binary=:all: -r packages/bake/src/objects/acquisition/dsk-requirements.txt
CSSEARTH_SPICE_PYTHON="$PWD/.local/dsk-python/bin/python" node packages/bake/cli/object-operations.mts acquire enceladus
```

This is an explicit preparation dependency, never a runtime browser dependency. Source restoration must fail clearly if it is absent; it must not silently use another converter or a stale hidden environment. The temporary research install under `/tmp/moons-b2-spiceypy` is not part of this recipe. Preserve the original DSK; the deterministic derivative ZIP retains exact coordinates, original face winding, a full source-to-welded vertex map and the source and tool versions. Mesh simplification happens later under a separately measured error budget.

The actual corrected-v2 source conversion and the empty-destination repeat both passed. The original restoration receipt records the downloaded DSK, the converter and toolchain versions and the derivative sizes. Fixture tests remain separate from that actual-source evidence.
