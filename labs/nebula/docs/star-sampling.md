# Native-star sampling

In **Alignment**, select an image above the right sidebar's **Image / Star removal** tabs. Image keeps the placement, opacity and tone controls. Star removal keeps the existing 0–100% prepared comparison and adds sample inspection for the three approved native sources: VISTA, Horálek and WISE.

1. **Find samples** or click a star, refine its position in the magnifier, and **Add sample**. Use the arrows to inspect examples of different sizes. Your reference list and current star stay in place.
2. **Remove stars.** This is the main confirmation. It first learns profiles from the selected references, then applies them across the native image. There is no separate calibration prerequisite. Stage/count progress and **Cancel** cover the operation; unusable examples produce an explicit explanation.
3. **Compare** **Original / Without stars / Residual**. The 0–100% slider changes comparison strength. Add examples of missed stars and repeat. **Preview samples** is an optional, faster crop-only check before running the whole image.

Adding examples, changing inclusion, and opening the tab do not start whole-image removal. Removal extends the existing approved result so previously removed stars do not return. New outputs remain isolated local trials: they do not overwrite approved products or bake a 3D cloud. Whole-image processing can take substantially longer than sample previews.

Reference positions, inclusion, focused star and available crop previews survive refresh, bound to the original image hash and pixel grid. Active whole-image jobs belong to the local server: refreshing reconnects to the saved job ID instead of cancelling or starting another job. Closing or refreshing the page does not cancel it; Cancel sends an explicit server cancellation request. If the local server itself restarts, unfinished work is reported as interrupted rather than silently retried. A completed image result is restored only after the server verifies its saved identity and artifacts; restore never starts a new extraction. If cached files are missing or stale, keep the reference positions and explain that previews need refreshing.

The magnifier locates a position on the full-extent source preview; measurement uses the pinned original's native pixels. Sample and image coordinates remain independent of the camera, overlay placement and inspection tone. Help and fit details are in tooltips. **Copy calibration** retains the source binding and reference coordinates for replay.

A reference marked **Matched** shows the actual shared-bank mask/model/result used by application; selected reference positions reach those same final quality checks even if the ordinary detector misses them. Training contribution alone does not prove a match. Qualification is a fit-quality assessment, not physical star classification. Saturated, crowded or poorly fitted sources can remain. A successful sample does not establish that the whole image is star-free. Model assumptions and limitations are recorded in [METHOD.md](../METHOD.md#calibrate-from-native-star-samples).

## Local setup

From a clean checkout/cache at the repository root, restore the approved source images and their original detection products, then start the lab:

```sh
pnpm install --frozen-lockfile
python3 -m venv .local/nebula-lab/registration/venv
.local/nebula-lab/registration/venv/bin/python -m pip install numpy==1.26.4 scipy==1.13.1 opencv-python-headless==4.11.0.86
.local/nebula-lab/registration/venv/bin/python labs/nebula/src/process-image-candidates.py labs/nebula/models/lmc-star-separation/plan.json
pnpm lab:nebula
```

The source-processing command downloads missing hash-pinned originals and recreates the previously approved native separation/detection products. It does not prepare a new volume. Already-restored users can start the lab directly. Large inputs and sample PNGs/reports stay under ignored `.local/nebula-lab/`; reusable code and documentation are committed.

The local server validates the source, active registration and original detections before sampling. Python analyzes native unsigned RGB pixels. Sampling writes bounded crops; explicit whole-image application writes separate lossless native products and reduced inspection previews. The browser displays prepared images using ordinary retained DOM; no browser pixel processing is involved. Saved selections are scoped to image ID, source hash and native dimensions.
