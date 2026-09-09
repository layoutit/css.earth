# Reproducible DSK source restoration

The converter requires Python 3.12, SpiceyPy 6.0.3 (CSPICE N0067) and NumPy 2.3.5. `dsk-requirements.txt` pins every published binary wheel hash for those two releases, allowing pip to select the supported platform wheel while prohibiting unpinned source builds. `dsk-python-wheels.json` retains the primary PyPI filenames, URLs and SHA-256 pins. The converter checks the SpiceyPy and CSPICE runtime versions before reading source geometry. The qualified host uses Python 3.12; install a local environment from that interpreter:

```sh
python3.12 -m venv .local/dsk-python
.local/dsk-python/bin/python -m pip install --require-hashes --only-binary=:all: -r tools/objects/acquisition/dsk-requirements.txt
CSSEARTH_SPICE_PYTHON="$PWD/.local/dsk-python/bin/python" node tools/objects/dist/operations.js acquire enceladus
```

This is an explicit preparation dependency, never a runtime browser dependency. Source restoration must fail clearly if it is absent; it must not silently use another converter or a stale hidden environment. The temporary research install under `/tmp/moons-b2-spiceypy` is not part of this recipe. Preserve the original DSK; the deterministic derivative ZIP retains exact coordinates, original face winding, a full source-to-welded vertex map and source/tool/geometry hashes. Mesh simplification happens later under a separately measured error budget.

The temporary converter review still needs the real v2 conversion run and a clean-environment repeat before its derivative hash can be accepted. No actual-source conversion result is claimed by the fixture tests.
