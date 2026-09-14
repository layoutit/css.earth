# Lobster · NGC6357

H II regions and young clusters in the NGC6357 environment.

## Sources

This first comparison batch pins the official ESO **Publication TIFF 4K** variants, downloaded unchanged on 2026-09-12. These retain each master image’s full footprint; no local resizing or cropping was used. Native star removal runs on the selected TIFF’s actual pixel grid. Larger publisher masters remain available for a later quality comparison.

| Lens | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO/DSS2 · optical / near-infrared | 4000 × 3464 | 225.70′ × 195.48′ | [Source](https://www.eso.org/public/images/eso1226c/) |
| ESO VISTA · infrared | 4000 × 4000 | 90.92′ × 90.92′ | [Source](https://www.eso.org/public/images/eso1309a/) |

- **ESO/DSS2 · optical / near-infrared** — DSS2 composite · B optical and I near-infrared. Credit: Davide De Martin (ESA/Hubble), the ESA/ESO/NASA Photoshop FITS Liberator & Digitized Sky Survey 2.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1226c.tif); [publisher master](https://cdn.eso.org/images/original/eso1226c.tif) (13445 × 11645).
- **ESO VISTA · infrared** — Near-infrared · J / H / Ks. Credit: ESO/VVV Survey/D. Minniti. Acknowledgement: Ignacio Toledo.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1309a.tif); [publisher master](https://cdn.eso.org/images/original/eso1309a.tif) (16000 × 16000).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. These are independently stretched outreach RGB composites, not calibrated common-band luminosity measurements.

## Registration and reproducibility

- `observations.json` pins each downloaded TIFF by SHA-256 and actual dimensions, exact embedded publisher AVM TAN WCS, original master dimensions/link, and a common north-up frame. AVM reference pixels use the declared reference dimensions; they are not necessarily centered or expressed on the TIFF grid.
- The common frame contains all native source corners with a six-percent angular margin. No frame was cropped to make the photographs agree.
- `observation-structures.json` configures the shared wavelet structure extraction.
- `compiler.json` configures the generic relative-emission compiler. No Helix joint-fit recipe or planetary expansion prior is reused.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal/reconstruction.

## Interpretation and current evidence

The selected optical image is wide DSS2 survey context, not the very small VLT close-up. Its huge field includes unrelated stellar background and other clouds, so full image fitting is a deliberate foreground/background stress test; source coverage does not establish membership. VISTA provides finer infrared structure. The optical photographic survey has halo artifacts and lower effective angular resolution than the raster dimensions imply.

The source packet was verified against both image SHA-256 values and decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

Without spectroscopy or an independent volume, the compiler’s depth is a conditional diffuse prior. Compact lights are detected image features with illustrative depths; they are not a catalog of confirmed members with measured distances.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).
