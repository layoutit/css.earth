# WISE fixed-WCS catalogue alignment

The blue channel of the CDS W4/W2/W1 composite contains W1 point-source light. Its fixed publisher TAN WCS was checked against separately retrieved [AllWISE catalogue coordinates](https://irsa.ipac.caltech.edu/data/WISE/docs/release/AllWISE/expsup/sec2_1.html). The sample uses unsaturated 8 ≤ W1 ≤ 11 sources, W1 SNR > 30, no W1 contamination flag, no extended-source flag, and isolation greater than five displayed pixels from another selected catalogue source.

Before matching, the gate required at least 100 unique matches, all four quadrants, 50% raster hull, reserved median ≤0.75 and P90 ≤1.5 native WISE pixels, and each shifted control below 10% of the true match count. These thresholds were not relaxed. The source is sampled at approximately 14.6 arcsec/pixel, so this is a display-image positional check, not detector-resolution astrometry.

The result passed: 34,811 unique matches, 11,604 reserved checks, median 0.316 and P90 0.632 native WISE pixels, and 99.3% raster hull. Shifted controls produced 2,466–2,484 chance matches; reflection, rotation and scale controls produced 2,210–2,548. All coordinates were excluded from fitting because **no transform was fitted**. The publisher WCS remains unchanged. The additional reserved subset makes the reported evaluation split explicit.

This verifies W1 geometry. It does not repair or validate W4/W2 color seams, diffuse calibration, or an astrophysical correspondence to the simulated density. The catalogue and image originate from the same survey; the validation checks independently retrieved catalogue positions against the published raster WCS.

Source images and the 70,630-row catalogue response remain ignored. `query.json` preserves the exact complete query; `procedure.json` pins input hashes, code, versions and expected evidence. From anywhere inside this checkout, this complete sequence reconstructs an empty local cache and runs the registration check only:

```sh
cd "$(git rev-parse --show-toplevel)"
/usr/bin/python3 -m venv .local/nebula-lab/registration/venv
.local/nebula-lab/registration/venv/bin/python -m pip install -r labs/nebula/models/lmc-candidates/source/wise-registration/requirements.txt
.local/nebula-lab/registration/venv/bin/python labs/nebula/models/lmc-candidates/source/wise-registration/replay.py
```

The recorded environment uses Python 3.9.6; another system needs compatible Python 3.9. A changed source or reordered catalogue response fails the pinned hash explicitly. Append `--verify-only` to the last command to check code hashes and syntax without downloads or matching. No star removal or cloud processing is included.
