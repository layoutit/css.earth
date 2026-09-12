# Orion · M42

Asymmetric H II region and star-forming nebula.

## Sources

This first comparison batch pins the official ESO **Publication TIFF 4K** variants, downloaded unchanged on 2026-09-12. These retain each master image’s full footprint; no local resizing or cropping was used. Native star removal runs on the selected TIFF’s actual pixel grid. Larger publisher masters remain available for a later quality comparison.

| Lens | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO · optical | 4000 × 3106 | 59.95′ × 46.56′ | [Source](https://www.eso.org/public/images/eso1723a/) |
| ESO VISTA · infrared | 3252 × 4000 | 71.84′ × 88.35′ | [Source](https://www.eso.org/public/images/eso1006a/) |

- **ESO · optical** — Optical · i / H-alpha / r / G. Credit: ESO/G. Beccari.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1723a.tif); [publisher master](https://cdn.eso.org/images/original/eso1723a.tif) (16877 × 13107).
- **ESO VISTA · infrared** — Near-infrared · K / J / Z. Credit: ESO/J. Emerson/VISTA. Acknowledgment: Cambridge Astronomical Survey Unit.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1006a.tif); [publisher master](https://cdn.eso.org/images/original/eso1006a.tif) (12640 × 15546).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. These are independently stretched outreach RGB composites, not calibrated common-band luminosity measurements.

## Registration and reproducibility

- `observations.json` pins each downloaded TIFF by SHA-256 and actual dimensions, exact embedded publisher AVM TAN WCS, original master dimensions/link, and a common north-up frame. AVM reference pixels use the declared reference dimensions; they are not necessarily centered or expressed on the TIFF grid.
- The common frame contains all native source corners with a six-percent angular margin. No frame was cropped to make the photographs agree.
- `observation-structures.json` configures the shared wavelet structure extraction.
- `compiler.json` configures the generic relative-emission compiler. No Helix joint-fit recipe or planetary expansion prior is reused.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal/reconstruction.

## Interpretation and current evidence

The optical image covers the main M42 nebula and its immediate cluster; the infrared source is wider. Neither image covers the entire Orion molecular-cloud complex. The saturated core, diffraction spikes and bright stellar halos must not become inferred nebular structures.

The source packet was verified against both image SHA-256 values and decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

Without spectroscopy or an independent volume, the compiler’s depth is a conditional diffuse prior. Compact lights are detected image features with illustrative depths; they are not a catalog of confirmed members with measured distances.

The [Orion structure and velocity research](physical-structure.md) identifies the current extrusion error, public spectroscopic maps, component-specific physical models and the next constrained experiment. These measurements are not yet wired into the compiler.

## Star photometry correction · 12 September 2026

Compact lights now use local background-subtracted NOX residual aperture light, source color and an equivalent angular disk area. There is no faint-star opacity floor, whitening or brightest-star normalization. Each lens supplies its own appearance at the same 650 reference-catalogue positions and modeled depths. Stars absent from the reference catalogue are not added; missing light/coverage in another lens produces zero light. These are encoded RGB display measurements, not calibrated stellar flux.

The previous optical markers emitted 21.78 times the measured residual aperture display energy at the 1024px reference framing. The revised prepared disks preserve 99.70% for optical and 99.86% for VISTA; peak intensity never exceeds the corresponding original aperture peak. Browser alpha compositing and pixel sampling are separate from this preparation-space accounting.

The exact saved request (Detail 100%, Faint 35%, Depth 1×) was rebuilt as `e94ec60c3b2128e213cb20b041a3726f136d61b6a810670794aca01339605f41`. Against its prior result `287801eff85c5adf01ae298c63fe8b55711fdb746a0ff83cfad2da53fce3ac2b`, the volume field, alpha digest, 650 IDs and XYZ positions are unchanged. The default 65% Detail publication is `7312292273a7cb0f9975fa492a3de85146b911b2857621d1f5d3c8b7d46d4d8d`.

Validation: strict lab TypeScript, lab build and 300 passing tests (two skipped). Restoring the old opacity floor makes the photometry regression fail. Real Chromium inspection of both M42 lenses verified fixed star centers, lens-specific appearance, angular sizing during zoom, rotation, star visibility, original overlay and refresh. Front/oblique images were inspected: excessive star amplification is corrected; diffuse side geometry and optical coverage boundaries remain visible and unresolved.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).
