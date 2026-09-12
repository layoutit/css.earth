# Messier 78

Reflection nebula, star formation and obscuring dust.

## Sources

This first comparison batch pins the official ESO **Publication TIFF 4K** variants, downloaded unchanged on 2026-09-12. These retain each master image’s full footprint; no local resizing or cropping was used. Native star removal runs on the selected TIFF’s actual pixel grid. Larger publisher masters remain available for a later quality comparison.

| Lens | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO · optical | 4000 × 3876 | 34.43′ × 33.36′ | [Source](https://www.eso.org/public/images/eso1105a/) |
| ESO VISTA · infrared | 4000 × 2968 | 72.79′ × 54.02′ | [Source](https://www.eso.org/public/images/eso1635a/) |

- **ESO · optical** — Optical · H-alpha / R / V / B. Credit: ESO/Igor Chekalin.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1105a.tif); [publisher master](https://cdn.eso.org/images/original/eso1105a.tif) (8679 × 8411).
- **ESO VISTA · infrared** — Near-infrared · Z / Y / H / Ks / J. Credit: ESO.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1635a.tif); [publisher master](https://cdn.eso.org/images/original/eso1635a.tif) (12815 × 9510).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. These are independently stretched outreach RGB composites, not calibrated common-band luminosity measurements.

## Registration and reproducibility

- `observations.json` pins each downloaded TIFF by SHA-256 and actual dimensions, exact embedded publisher AVM TAN WCS, original master dimensions/link, and a common north-up frame. AVM reference pixels use the declared reference dimensions; they are not necessarily centered or expressed on the TIFF grid.
- The common frame contains all native source corners with a six-percent angular margin. No frame was cropped to make the photographs agree.
- `observation-structures.json` configures the shared wavelet structure extraction.
- `compiler.json` configures the generic relative-emission compiler. No Helix joint-fit recipe or planetary expansion prior is reused.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal/reconstruction.

## Interpretation and current evidence

The optical frame covers the central M78 region, while VISTA covers more surrounding cloud. Their orientations differ by about 103 degrees and must come from WCS, not visual rotation guesses. Reflection/scattering and foreground extinction are not modeled by positive relative-emission fitting; results remain a visualization hypothesis.

The source packet was verified against both image SHA-256 values and decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

Without spectroscopy or an independent volume, the compiler’s depth is a conditional diffuse prior. Compact lights are detected image features with illustrative depths; they are not a catalog of confirmed members with measured distances.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).
