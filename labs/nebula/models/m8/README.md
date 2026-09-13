# Lagoon · M8

Asymmetric H II region and star-forming nebula.

## Sources

This first comparison batch pins the official ESO **Publication TIFF 4K** variants, downloaded unchanged on 2026-09-12. These retain each master image’s full footprint; no local resizing or cropping was used. Native star removal runs on the selected TIFF’s actual pixel grid. Larger publisher masters remain available for a later quality comparison.

| Lens | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO · optical | 4000 × 2679 | 93.49′ × 62.61′ | [Source](https://www.eso.org/public/images/eso0936a/) |
| ESO VISTA · infrared | 4000 × 2202 | 71.81′ × 39.54′ | [Source](https://www.eso.org/public/images/eso1101d/) |

- **ESO · optical** — Optical · H-alpha / R / V / B. Credit: ESO.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso0936a.tif); [publisher master](https://cdn.eso.org/images/original/eso0936a.tif) (23569 × 15784).
- **ESO VISTA · infrared** — Near-infrared · J / H / Ks (caption; publisher AVM incorrectly labels H as H-alpha). Credit: ESO/VVV. Acknowledgment: Cambridge Astronomical Survey Unit.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1101d.tif); [publisher master](https://cdn.eso.org/images/original/eso1101d.tif) (12630 × 6954).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. These are independently stretched outreach RGB composites, not calibrated common-band luminosity measurements.

## Registration and reproducibility

- `observations.json` pins each downloaded TIFF by SHA-256 and actual dimensions, exact embedded publisher AVM TAN WCS, original master dimensions/link, and a common north-up frame. AVM reference pixels use the declared reference dimensions; they are not necessarily centered or expressed on the TIFF grid.
- The common frame contains all native source corners with a six-percent angular margin. No frame was cropped to make the photographs agree.
- `observation-structures.json` configures the shared wavelet structure extraction.
- `compiler.json` configures the generic relative-emission compiler. No Helix joint-fit recipe or planetary expansion prior is reused.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal/reconstruction.

## Interpretation and current evidence

The optical mosaic is wider than the VISTA strip. Missing infrared support at the northern/southern optical margins is no-data, not absent gas. The VISTA caption gives J/H/Ks; its filter table and AVM incorrectly identify H as H-alpha. The recipe documents the discrepancy rather than treating this as infrared H-alpha.

The source packet was verified against both image SHA-256 values and decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

Without spectroscopy or an independent volume, the compiler’s depth is a conditional diffuse prior. Compact lights are detected image features with illustrative depths; they are not a catalog of confirmed members with measured distances.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).
