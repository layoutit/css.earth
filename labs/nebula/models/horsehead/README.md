# Horsehead / Flame

Dark nebula / photodissociation region, IC434 emission and the Flame star-forming environment.

## Sources

This first comparison batch pins the official ESO **Publication TIFF 4K** variants, downloaded unchanged on 2026-09-12. These retain each master image’s full footprint; no local resizing or cropping was used. Native star removal runs on the selected TIFF’s actual pixel grid. Larger publisher masters remain available for a later quality comparison.

| Lens | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO · optical | 4000 × 3655 | 179.14′ × 163.75′ | [Source](https://www.eso.org/public/images/eso0949k/) |
| ESO VISTA · infrared | 3288 × 4000 | 71.50′ × 86.97′ | [Source](https://www.eso.org/public/images/eso0949n/) |

- **ESO · optical** — Optical · R / B. Credit: ESO and Digitized Sky Survey 2. Acknowledgment: Davide De Martin .
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso0949k.tif); [publisher master](https://cdn.eso.org/images/original/eso0949k.tif) (10663 × 9744).
- **ESO VISTA · infrared** — Near-infrared · K / H / J. Credit: ESO/J. Emerson/VISTA. Acknowledgment: Cambridge Astronomical Survey Unit.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso0949n.tif); [publisher master](https://cdn.eso.org/images/original/eso0949n.tif) (12564 × 15283).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. These are independently stretched outreach RGB composites, not calibrated common-band luminosity measurements.

## Registration and reproducibility

- `observations.json` pins each downloaded TIFF by SHA-256 and actual dimensions, exact embedded publisher AVM TAN WCS, original master dimensions/link, and a common north-up frame. AVM reference pixels use the declared reference dimensions; they are not necessarily centered or expressed on the TIFF grid.
- The common frame contains all native source corners with a six-percent angular margin. No frame was cropped to make the photographs agree.
- `observation-structures.json` configures the shared wavelet structure extraction.
- `compiler.json` configures the generic relative-emission compiler. No Helix joint-fit recipe or planetary expansion prior is reused.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal/reconstruction.

## Interpretation and current evidence

The wide optical DSS2 and full VISTA frames include Horsehead, Flame and NGC2023. They are an environment rather than one isolated object. The Horsehead is a dark silhouette, so a positive-emission compiler cannot yet recover its absorbing material. Star halos and diffraction spikes need explicit inspection after NOX. This is a model-limitation benchmark, not an accepted Horsehead density reconstruction.

The source packet was verified against both image SHA-256 values and decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

Without spectroscopy or an independent volume, the compiler’s depth is a conditional diffuse prior. Compact lights are detected image features with illustrative depths; they are not a catalog of confirmed members with measured distances.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).
