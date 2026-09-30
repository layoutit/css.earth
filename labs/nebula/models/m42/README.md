# Orion · M42

This file preserves processing studies and their dated results. The
[current shipped object record](../../../../src/objects/m42/README.md) owns
the active sources, delivery evidence and known problems. Historical experiments
below do not qualify later deliveries.

Asymmetric H II region and star-forming nebula.

## Sources

This first comparison batch pins the official ESO **Publication TIFF 4K** variants, downloaded unchanged on 2026-09-12. These retain each master image’s full footprint; no local resizing or cropping was used. Native star removal runs on the selected TIFF’s actual pixel grid. Larger publisher masters remain available for a later quality comparison.

| Dataset | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO · optical | 4000 × 3106 | 59.95′ × 46.56′ | [Source](https://www.eso.org/public/images/eso1723a/) |
| ESO VISTA · infrared | 3252 × 4000 | 71.84′ × 88.35′ | [Source](https://www.eso.org/public/images/eso1006a/) |

- **ESO · optical** — Optical · i / H-alpha / r / G. Credit: ESO/G. Beccari.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1723a.tif); [publisher master](https://cdn.eso.org/images/original/eso1723a.tif) (16877 × 13107).
- **ESO VISTA · infrared** — Near-infrared · K / J / Z. Credit: ESO/J. Emerson/VISTA. Acknowledgment: Cambridge Astronomical Survey Unit.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1006a.tif); [publisher master](https://cdn.eso.org/images/original/eso1006a.tif) (12640 × 15546).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. These are independently stretched outreach RGB composites, not calibrated common-band luminosity measurements.

## Registration and reproducibility

- `observations.json` names each downloaded TIFF by URL with its actual dimensions, exact embedded publisher AVM TAN WCS, original master dimensions/link, and a common north-up frame. AVM reference pixels use the declared reference dimensions; they are not necessarily centered or expressed on the TIFF grid.
- The common frame contains all native source corners with a six-percent angular margin. No frame was cropped to make the photographs agree.
- `observation-structures.json` configures the shared wavelet structure extraction.
- `compiler.json` configures the generic relative-emission compiler. No Helix joint-fit recipe or planetary expansion prior is reused.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal/reconstruction.

## Interpretation and current evidence

The optical image covers the main M42 nebula and its immediate cluster; the infrared source is wider. Neither image covers the entire Orion molecular-cloud complex. The saturated core, diffraction spikes and bright stellar halos must not become inferred nebular structures.

The source packet was verified against both images' decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

The compiler uses an evidence-addressed, authored irregular front. Compact lights are detected image features with conditional depths; they are not a catalog of confirmed members with measured distances.

The [Orion structure and velocity research](physical-structure.md) records public spectroscopic maps and component-specific physical models. Published morphology and local reference scales guide the current support recipe. The downloaded velocity/diagnostic arrays are not yet fitted.

## Evidence-guided depth experiment

[physical-evidence.json](physical-evidence.json) distinguishes observed quantities, published models and authored choices. [depth-model.json](depth-model.json) pins that ledger and contains every active support parameter. The generic compiler verifies both, preserves immutable copies with each result, then fits projected emission on locally tilted finite supports.

- One curved front supplies coherent depth. Small features keep local thickness; the former global depth floor no longer stretches them into long columns. Inclination preserves each support's analytic observer projection.
- The central reference uses the approximate 0.2 pc star/front separation and 0.1 pc equivalent emitting layer at the paper's 440 pc distance. The 100″ × 90″ blending window, curvature and interpolation are authored. These scales never define the whole 104′ image frame.
- The wider curvature and southwest opening are visualization hypotheses. The separate Orion-S cloud, incomplete OIII cavity, foreground Veil, extinction and radiative-transfer physics remain unsupported by this single-surface model. A smooth deformation must not be described as their reconstruction.
- The implementation fits relative image emission, not mass density. Changing depth does not fit velocities. Optical/VISTA use identical geometry and alpha, and keep their source-specific stellar appearance.

The [Nebula Compiler Process Guidelines](../../docs/nebula-compiler-guidelines.md) describe the reusable evidence intake, method selection and acceptance workflow. Carina is the next independent experiment; Orion's numerical recipe is not transferred to it.

## Star photometry correction · 12 September 2026

Compact lights now use local background-subtracted NOX residual aperture light, source color and an equivalent angular disk area. There is no faint-star opacity floor, whitening or brightest-star normalization. Each dataset supplies its own appearance at the same 650 reference-catalogue positions and modeled depths. Stars absent from the reference catalogue are not added; missing light/coverage in another dataset produces zero light. These are encoded RGB display measurements, not calibrated stellar flux.

The previous optical markers emitted 21.78 times the measured residual aperture display energy at the 1024px reference framing. The revised prepared disks preserve 99.70% for optical and 99.86% for VISTA; peak intensity never exceeds the corresponding original aperture peak. Browser alpha compositing and pixel sampling are separate from this preparation-space accounting.

The exact saved request (Detail 100%, Faint 35%, Depth 1×) was rebuilt as `m42-detail-100`. Against its prior result `m42-before-detail-100`, the volume field, neutral alpha, 650 IDs and XYZ positions are unchanged. The default 65% Detail publication is `m42`.

Validation: strict lab TypeScript, lab build and 300 passing tests (two skipped). Restoring the old opacity floor makes the photometry regression fail. Real Chromium inspection of both M42 datasets verified fixed star centers, dataset-specific appearance, angular sizing during zoom, rotation, star visibility, original overlay and refresh. Front/oblique images were inspected: excessive star amplification is corrected; diffuse side geometry and optical coverage boundaries remain visible and unresolved.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).

## Coherent-front comparison · 12 September 2026

Default result: `m42-coherent-front` (Detail 65%, Faint 35%, Depth 1×). Its method record snapshots the runnable recipe and evidence ledger. The fit contains 355 supports and 650 compact lights; observer RMSE is 0.030138, missing relative signal 8.05% and excess relative signal 9.86%. These compare against the combined display target, not calibrated flux.

The XYZ bake uses 321/512/127 slabs, 512px in-plane width and four samples per slab. Material color is emission-weighted within each slab. Both source datasets preserve the neutral bank's alpha exactly. The final geometry/material bake took 38.6 seconds with alignment and NOX reused; source acquisition and initial separation are excluded.

Real Chromium inspection passed source switching, stable star positions across datasets, star visibility, original overlay, refresh, observer/oblique and 90° west/89° north views. No inspection action started processing. The rotating shape has localized thickness rather than the previous uniform deep columns.

The earlier default observer RMSE was 0.039561; the current fit reduces it by 23.8%. This gain also reflects narrower XY supports and a larger usable basis budget, not just changing depth. The saved 100% Detail request and original image transforms were separately completed as `m42-detail-100-original-transforms`. User settings and historical receipts were not overwritten.

Visual limits: the support remains a coarse authored surface, and oblique color bands/fine slice traces remain visible. Narrow optical coverage leaves explicitly neutral material outside its footprint. This is a useful experimental comparison, not production visual acceptance or a measured 3D density. Three bounded iterations addressed the depth floor/tilt, slab spacing and material sampling; further artifact work belongs in volumetric material reconstruction and sampling, not invented evidence or per-view image masks.

Next: qualify physical-map coverage and uncertainty, implement a compatible forward observable, then compare multiple distinct fronts/embedded structures. Keep the present single-front hypothesis as a baseline; do not interpret its local smooth deformations as recovered cavities or shells.
