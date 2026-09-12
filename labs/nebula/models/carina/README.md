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
- `compiler.json` configures the generic relative-emission compiler. No Helix joint-fit recipe or planetary expansion prior is reused.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal/reconstruction.

## Interpretation and current evidence

The VISTA field covers the main complex more broadly than this 33-arcminute optical image. Optical outskirts remain unobserved by this lens. This batch uses ESO0905a because its embedded ICRS astrometry is supported; the wider ESO1250a optical alternative uses FK5/J2000 and opposite Y handedness, requiring explicit frame support and revalidation before adoption. Whole-image preservation must not be confused with complete multiband nebula coverage.

The source packet was verified against both image SHA-256 values and decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

Without spectroscopy or an independent volume, the compiler’s depth is a conditional diffuse prior. Compact lights are detected image features with illustrative depths; they are not a catalog of confirmed members with measured distances.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).
