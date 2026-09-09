# Ciel Austral optical registration replay

The candidate is the authors' RHaVBO `photo95fb.jpg`, 14400 × 14200 pixels, credited to Team Ciel Austral: J. C. Canonne, N. Outters, P. Bernhard, D. Chaplain and L. Bourgon. The [author gallery](https://www.cielaustral.com/galerie/photo95.htm) identifies this color version. [APOD](https://apod.nasa.gov/apod/ap190503.html) explicitly credits copyright to the team; no open reuse license is stated. This is broadband optical color with narrowband enhancement, not calibrated natural-color photometry.

The first registration attempt passed: 4,418 surrounding-star pattern identities; 1,473 held out; median 0.906, P90 2.015 and maximum 5.377 native SMASH pixels. The matched hull covers 74.1% of the source; its remaining outer area is extrapolated. All three shifted-star controls produced zero confirmed patterns. Reflection, rotation and scale controls failed. The inspected contact sheet and complete centroid lists remain in the ignored registration directory.

`validate-ciel.patch` reconstructs the exact helper from the pinned shared validator. Its only changes handle the absence of source WCS and label the contact sheet. Detection, correspondence, fitting, held-out and acceptance thresholds remain unchanged. The minimal recipe contains only Ciel Austral and the SMASH reference WCS. `procedure.json` pins source URLs and hashes, helper hashes, commands and dependency versions. Full direction evidence is in `../ciel-austral-registration.json`; credit and source evidence are in `../ciel-austral-source.json`.

From anywhere inside this checkout, this complete sequence recreates an empty local cache, downloads missing source images, checks hashes, reconstructs the helper and reruns only registration:

```sh
cd "$(git rev-parse --show-toplevel)"
/usr/bin/python3 -m venv .local/nebula-lab/registration/venv
.local/nebula-lab/registration/venv/bin/python -m pip install -r labs/nebula/models/lmc-candidates/source/ciel-registration/requirements.txt
.local/nebula-lab/registration/venv/bin/python labs/nebula/models/lmc-candidates/source/ciel-registration/replay.py
```

The observed macOS environment has Python 3.9.6 at `/usr/bin/python3`; another system needs compatible Python 3.9 and the standard `patch` utility. The source JPEG and reference TIFF remain ignored local inputs. Changed downloads or validator bytes fail explicitly. Add `--verify-only` to the final command for hash, reconstruction and syntax verification without downloads or registration. No star removal, diffuse processing or cloud bake is included.
