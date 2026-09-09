# Wider SMASH registration replay

This package preserves the procedure that registered the 4111 × 5000 survey-author mosaic to the smaller NOIRLab SMASH image. The original seed and outskirts scripts are unchanged. `validate-mosaic.patch` reconstructs the exact research helper from the pinned shared validator; no second complete validator is checked in.

The accepted central fit has 20,661 matched stars, 6,887 held out, median 0.879 and P90 1.820 native SMASH pixels. Its source hull covers 30.0%. The separate DSS2 outskirts check found 2,138 confirmed matches outside the smaller SMASH rectangle, but its precision gate **failed**: outer P90 2.707 native DSS2 pixels. That failure remains in `../smash-mosaic-outskirts-check.json`; it is not a refined homography or an expanded precision claim.

`procedure.json` records source download URLs and hashes, exact helper hashes, dependency versions, original commands, and expected positive signals. No source images are checked in. The preserved scripts expect the repository root and write only ignored registration diagnostics. The observed environment used Python 3.9.6; OpenCV numerical details may differ on another platform.

From any directory inside this checkout, this complete sequence recreates an empty local cache, downloads missing inputs, checks pinned bytes, reconstructs the helper, and runs only star registration and its external check:

```sh
cd "$(git rev-parse --show-toplevel)"
/usr/bin/python3 -m venv .local/nebula-lab/registration/venv
.local/nebula-lab/registration/venv/bin/python -m pip install -r labs/nebula/models/lmc-candidates/source/smash-registration/requirements.txt
.local/nebula-lab/registration/venv/bin/python labs/nebula/models/lmc-candidates/source/smash-registration/replay.py
```

The recorded macOS environment supplies Python 3.9.6 at `/usr/bin/python3`; another system must supply a compatible Python 3.9 and the standard `patch` utility. Existing source files are reused only when their hashes agree; changed upstream downloads or a changed shared validator fail explicitly. This package does not remove stars, process diffuse clouds, or bake scene assets. To verify packaging alone, add `--verify-only` to the final command; that checks hashes, reconstructed helper bytes and Python syntax without downloads or registration.
