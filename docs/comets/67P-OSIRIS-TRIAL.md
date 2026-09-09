# 67P OSIRIS photographic trial

8 September 2026. Historical record of the first photographic experiment,
accepted by the user as a visual direction. Its original raw-photograph harness
and measurements below are preserved separately from the subsequent
[application integration](67P-OSIRIS-INTEGRATION.md), which adds detector-quality
gating and illumination correction. The application's default remains the
neutral Shape model lens; OSIRIS observation is an optional second lens.

## Source and interpretation

The [DLR textured-model catalogue](https://europlanet.dlr.de/Rosetta/) describes
single-observation SHAP7 products, but its access route requires contacting the
provider. No message was sent. Instead, this trial uses the public
[OSIRIS GEO archive](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/).

The pinned file is `n20140805t194314611id50f22.img`, 151,028,736 bytes, SHA-256
`de0884a0d83f972bb7f7025dfa784d2b153763dda035b43afa918c8023fe511b`.
Its MD5 matches the archive's checksum table. The calibrated label time is
**2014-08-05T19:44:22.918 UTC**, not the time embedded in the filename.
`FFP-Vis_Orange` is a single filter: the display is grayscale, not true color.

The [GEO product specification](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/document/calib/geo_products_v02.pdf)
describes calibrated radiance plus distance, emission, incidence, phase,
facet index and body-fixed XYZ planes. This file has nine 2048 × 2048 images;
floating-point planes are little-endian, XYZ and distance are kilometres, and
angles are radians. Radiance is W m⁻² sr⁻¹ nm⁻¹. Negative and zero measurements
are retained independently of the geometry footprint.

The [dataset errata](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/errata.txt)
reject other GEO geometry variants. The decoder requires the corrected history
value `cg-dlr_spg-shap7-v1.0_4Mfacets.ver`. The
[OSIRIS interface specification](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/document/sis/osiris_sis_v05.pdf)
defines the standard NAC display orientation used here: stored rows are flipped
vertically. The decoder refuses changed orientation, units, endian layout,
dimensions, truncated payloads and overlapping plane pointers.

Image credit: **ESA/Rosetta/MPS for OSIRIS Team MPS/UPD/LAM/IAA/SSO/INTA/UPM/DASP/IDA**.
[ESA's archive release](https://www.esa.int/Science_Exploration/Space_Science/Rosetta/Rosetta_image_archive_complete)
licenses OSIRIS images under CC BY-SA 4.0. The file's `SOFTWARE_LICENSE_TYPE`
describes the calibration software, not the image's reuse terms. The RMOC
geometry retains its separate [existing credits](../../src/planets/comet-67p/NOTICE.md).

## Transfer evidence

The camera is fitted from 10,011 deterministic pixel/XYZ correspondences; all
other 1,781,834 geometry-backed pixels are held out. Maximum held-out projection
residual is **0.002383 source pixel**. This establishes internal projective
consistency of the archived coordinates, not absolute spacecraft orientation or
independent image-landmark accuracy. An earlier full-RMOC projected silhouette
probe overlaps 98.996% of the archived geometric footprint; that comparison is
also geometry evidence, not image or albedo parity.

The preparer retains the existing RMOC MTP019 mesh reduction: **1,000 native
PolyCSS u leaves**, original source vertex positions, and 64 × 64 pixel cells in
a 1024 × 4032 atlas. At each texel it clamps atlas bleed to the retained triangle,
finds the closest full-source triangle point within 50 m, projects that point
through the recovered camera, and requires:

- All four bilinear contributors have finite radiance and positive distance/facet geometry.
- Each contributor's archived XYZ lies within 20 m of the matched RMOC point.
- Emission angle is at most 80 degrees.
- A ray through the full RMOC mesh reaches the same point within 0.5 m.

These are conservative experimental acceptance bounds, **not source accuracy
estimates**. They reject mismatched surface sheets at the neck and limb. There
is no radial nearest-branch lookup, nearest-vertex paint, hidden extrapolation,
image synthesis or runtime source projection.

394,121 of 1,782,240 interior atlas samples pass. These are texel counts, **not
surface-area coverage**. Accepted closest-source distances have median 8.304 m,
95th percentile 28.326 m and maximum 49.991 m. The maximum contributing GEO
pixel separation is 20 m. Bleed samples are excluded from these counts.

Gray grid means no accepted **photograph** sample. It does not change the
scientific interpretation of the underlying measured RMOC shape. Photographed
shadows remain in the texture; no additional illumination is applied to accepted
samples. A single linear 1–99% radiance stretch is shared by the source image and
CSS atlas.

## Browser evidence and limits

Real headless Chrome 152.0.7977.76 was exercised at DPR 1 and 2, with separate
contexts and the same loaded atlas, image and HTML hashes. Both performed a
108°/31.5° drag with all 1,000 original leaves retained, zero leaf or tree
mutations, no console/page errors, and no canvas or SVG scene elements. The
runtime only changes the retained camera/pose and the prepared coverage variant.

The source and browser frames use the same recovered camera. The 640 × 640
absolute RGB difference has no gain applied. Mean absolute channel difference
is 12.237/255 over the frame and 12.059/255 over 129,998 confidently white pixels
in the rendered acceptance mask. This includes mesh simplification, source-mesh
disagreement, atlas sampling, gaps and browser antialiasing; it is not a claim of
photographic reconstruction accuracy.

The headless drag's requestAnimationFrame spacing was approximately 50 ms at
both DPRs. This is **not a 60 fps qualification** or proof of physical-device
performance. The harness does not exercise the shared application's input policy.

Focused decoder/calibration tests and existing OBJ, radial-terrain and
source-mesh-lighting tests pass. Two complete bakes produced identical image
and atlas hashes. The full acquire/test/build/browser production gates were
not run for this isolated intake experiment; no object-readiness claim follows.

## Reproduce and inspect

From the existing Comets checkout, with repository dependencies installed:

```sh
node tools/objects/comet-67p/inspect-osiris-geo.mjs --download
node --test tools/inspect-osiris-geo.test.mjs
```

The download flag only acquires the pinned original when absent. Modified
cached input is rejected. Default output is
`output/comet-intake/67p-rosetta/`: `index.html`, `observation.png`, `atlas.png`,
`coverage-atlas.png` and `report.json`. Serve that directory locally to inspect
the rotatable trial. Source and preparation code never enter that HTML runtime.

This run's companion evidence is in `output/playwright/comet-67p-osiris-*`:
source, CSS, coverage and turned screenshots at both DPRs; a three-panel
comparison; an absolute diff; and the capture script/log. `browser-report.json`
beside the trial records screenshot hashes and verifies the browser-loaded
assets against the prepared report. The older `probe.py` and `probe-report.json`
there retain the independent NumPy/SVD alignment and full-source silhouette probe.

The trial materializes about 161 MiB plus browser captures. It reuses
`/Users/ekrof/fed/cssEarth-comets` on `feat/comet-67p-rosetta-lens`; no new
worktree was created. The main checkout and unrelated files were preserved.

## Follow-up from this trial

The application integration qualifies the matching L4 quality flags, defines
approximate disk normalization and the remaining photographed-shadow limits,
and uses the common lens and lighting controls. Its fresh production evidence
is recorded separately; the raw trial's captures do not prove that integration.

A same-budget SHAP7 comparison remains a possible source improvement. The
current integration retains RMOC geometry and withholds failed correspondences;
it does not assume the two source models are identical.
