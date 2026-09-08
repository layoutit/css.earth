# Naztronomy image alignment replay

This preserves registration of the author's 3074 × 3163 public quarter-scale image to the pinned NOIRLab SMASH reference. It does not fetch the inaccessible 160-megapixel AstroBin version. The public WordPress media record identifies the downloaded `original_image`; a normal browser User-Agent is retained for that public asset request.

The accepted fit has 4,861 distinct stars, 1,621 held out, median 0.304 and P90 0.663 native SMASH pixels. The matched hull covers 73.85% of the source. Mirror, rotation, scale and scrambled-position controls fail. Outer corners remain extrapolated; this is image-to-image registration anchored to SMASH's publisher WCS, not an absolute catalog solution or a physical simulation fit.

The shared validator and existing SMASH helper patch are reused with their exact hashes; no second complete validator is stored here. `procedure.json` records original inputs, helper hashes and commands. `recipe.json` contains only the two required image records.

From a directory inside the checkout, this complete sequence prepares dependencies, downloads missing pinned images and replays only star alignment:

```sh
cd "$(git rev-parse --show-toplevel)"
/usr/bin/python3 -m venv .local/nebula-lab/registration/venv
.local/nebula-lab/registration/venv/bin/python -m pip install -r labs/nebula/models/lmc-candidates/source/smash-registration/requirements.txt
.local/nebula-lab/registration/venv/bin/python labs/nebula/models/lmc-candidates/source/naztronomy-registration/replay.py
```

The recorded environment uses Python 3.9.6 and the standard `patch` utility. Existing inputs are accepted only if their hashes match. Add `--verify-only` to the final command to check hashes, helper reconstruction and syntax without downloading or rerunning alignment.

The source page labels this file broadband RGB, while its embedded credit footer mentions RGB plus dual narrowband. That discrepancy is preserved in the source receipt; use the neutral “Naztronomy optical” label. Copyright remains with Naztronomy and collaborators; no explicit redistribution license was found. Stars, credit strip and image content are retained. No cloud extraction, star removal or volume bake occurs.
