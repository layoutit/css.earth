# Carina

Complex H II region and massive-star formation.

## Sources

This first comparison batch pins the official ESO **Publication TIFF 4K** variants, downloaded unchanged on 2026-09-12. These retain each master image’s full footprint; no local resizing or cropping was used. Native star removal runs on the selected TIFF’s actual pixel grid. Larger publisher masters remain available for a later quality comparison.

| Lens | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO · optical | 4000 × 3966 | 33.37′ × 33.09′ | [Source](https://www.eso.org/public/images/eso0905a/) |
| ESO VISTA · infrared | 4000 × 3245 | 88.49′ × 71.78′ | [Source](https://www.eso.org/public/images/eso1828b/) |

- **ESO · optical** — Optical · B / U / V / R / Sii / H-alpha. Credit: ESO.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso0905a.tif); [publisher master](https://cdn.eso.org/images/original/eso0905a.tif) (8408 × 8337).
- **ESO VISTA · infrared** — Near-infrared · Ks / J / Z. Credit: ESO/J. Emerson/M. Irwin/J. Lewis.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1828b.tif); [publisher master](https://cdn.eso.org/images/original/eso1828b.tif) (15542 × 12608).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. These are independently stretched outreach RGB composites, not calibrated common-band luminosity measurements.

## Registration and reproducibility

- `observations.json` pins each downloaded TIFF by SHA-256 and actual dimensions, exact embedded publisher AVM TAN WCS, original master dimensions/link, and a common north-up frame. AVM reference pixels use the declared reference dimensions; they are not necessarily centered or expressed on the TIFF grid.
- The common frame contains all native source corners with a six-percent angular margin. No frame was cropped to make the photographs agree.
- `observation-structures.json` configures the shared wavelet structure extraction.
- `compiler.json` configures the generic relative-emission compiler and its `depth-model.json` recipe. The latter pins `physical-evidence.json`: one authored curved height surface, with localized deformations at the Trumpler 14, Eta Car and WR25 sky anchors. No Helix joint-fit recipe or planetary expansion prior is reused.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal/reconstruction.

## Interpretation and current evidence

The VISTA field covers the main complex more broadly than this 33-arcminute optical image. Optical outskirts remain unobserved by this lens. This batch uses ESO0905a because its embedded ICRS astrometry is supported; the wider ESO1250a optical alternative uses FK5/J2000 and opposite Y handedness, requiring explicit frame support and revalidation before adoption. Whole-image preservation must not be confused with complete multiband nebula coverage.

The source packet was verified against both image SHA-256 values and decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

The current recipe replaces the centered diffuse depth prior with an **authored single height surface**. Published central morphology motivates three local deformations, while their depth, curvature, thickness and blend strengths remain assumptions. The wide background is explicitly unconstrained. This solver cannot represent overlapping shells, disconnected fronts, foreground absorption or true empty cavities. See [physical evidence and scope](physical-structure.md).

The downloaded optical line-fit catalogue is pinned separately; its velocities are **not fitted** by this recipe. The source's Gaussian widths are not centroid uncertainties. No Herschel or CO map has been imported. Compact lights retain observed image positions with illustrative depths; their distances and membership are unmeasured. All lenses share the same geometry, alpha and lights.

The configured comparison has now been compiled and inspected. See the result record below; this does not establish a physical reconstruction.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).

## Coherent-front comparison · 12 September 2026

Default result: `6f33f78232e0fd3b5548257a8ee4b2b32d798f95df4ca2dc594168a32a430f02` (Detail 65%, Faint 35%, Depth 1×). Its method record snapshots the runnable recipe and evidence ledger and pins the implementation owners. The fit contains 359 supports and 650 compact lights; observer RMSE is 0.051339, missing relative signal 21.66% and excess relative signal 20.30%. These compare against the combined display target, not calibrated flux.

The XYZ bake uses 512/497/126 slabs, 512px in-plane width and four samples per slab. Material color is emission-weighted within each slab. Both source lenses preserve the neutral alpha digest `9f69edc53a0a11e9139c4134ee9dc1924881de4abfe89f13f79a6aa3ec509a39`. The final geometry/material bake took 26.6 seconds with alignment and NOX reused; source acquisition and initial separation are excluded.

Real Chromium inspection passed source switching, stable star positions across lenses, star visibility, original overlay, refresh, observer/oblique and 90° west/89° north views. No inspection action started processing. The rotating shape has localized thickness rather than the previous uniform deep columns.

Visual limits: the support remains a coarse authored surface, and oblique color bands/fine slice traces remain visible. Narrow optical coverage leaves explicitly neutral material outside its footprint. This is a useful experimental comparison, not production visual acceptance or a measured 3D density. Three bounded iterations addressed the depth floor/tilt, slab spacing and material sampling; further artifact work belongs in volumetric material reconstruction and sampling, not invented evidence or per-view image masks.

Next: qualify physical-map coverage and uncertainty, implement a compatible forward observable, then compare multiple distinct fronts/embedded structures. Keep the present single-front hypothesis as a baseline; do not interpret its local smooth deformations as recovered cavities or shells.
