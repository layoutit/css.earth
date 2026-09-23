# LMC image registration

Six inspection references share one sky plane. The density remains in its independently reconstructed observer frame. The saved SMASH manual fit is a separate display alignment, transferred to every image using a common affine transform; it is not a new astrometric calibration.

| Reference | Native pixels | Registration | Licence |
|---|---:|---|---|
| [SMASH](https://noirlab.edu/public/images/noirlab2030a/) | 6737 × 6536 | Publisher TAN WCS | CC BY 4.0 |
| [VISTA](https://www.eso.org/public/images/eso1914a/) | 3581 × 4000 derivative | Publisher TAN WCS | CC BY 4.0 |
| Previous SMASH extraction | Existing derivative | Same SMASH footprint | CC BY 4.0 |
| [Gaia EDR3, foreground removed](https://commons.wikimedia.org/wiki/File:Large_Magellanic_Cloud_rendered_from_Gaia_EDR3_without_foreground_stars.png) | 8000 × 8000 | 330 matched stellar sources | CC BY-SA 4.0 |
| [Horálek optical wide field](https://noirlab.edu/public/images/iotw2547a/) | 6582 × 4388 | 592 matched stars | CC BY 4.0 |
| [ESO VST Tarantula](https://www.eso.org/public/images/eso1816a/) | 3985 × 4000 derivative | Publisher TAN WCS; not independently star-fitted | CC BY 4.0 |

Gaia is a rendering of catalogue stars, not a nebular photograph. The creator describes synthetic filter colours and a 20 kpc foreground cutoff. No historical projection parameters or WCS were available; its measured registration does not invent a TAN projection. Different passbands and grades must remain separate until a later composition experiment.

## Measured shared-star fits

SIFT descriptors and RANSAC supplied initial correspondence seeds. High-pass isolated local maxima and weighted centroids refined the star positions, with unique SMASH assignments and outlier rejection. Gaia additionally required surrounding-star pattern correlation greater than 0.3, excluding the central four-pixel radius. A shifted-position control accepted zero of 410 candidates.

Every third final correspondence was excluded from the final homography fit. This is a fit holdout: discovery still used the common robust seed, so it is not blind external catalogue validation.

| Image | Fit / held out | Held-out median / P90, native SMASH pixels | Source area enclosed by matches |
|---|---:|---:|---:|
| Gaia | 220 / 110 | 1.168 / 2.093 | 17.8% |
| Horálek | 394 / 198 | 0.585 / 1.121 | 60.2% |

SMASH's scale is about 4.996 arcseconds per pixel. Gaia's wider outer field is extrapolated beyond the measured footprint. These homographies are starting registrations for visual inspection, not precision calibration across the entire raster.

The checked-in `models/lmc/overlays/source/registration-receipts.json` preserves native source/reference coordinates, fit masks, matrices, residuals, image hashes and limitations. `models/image-overlays.json` pins the exact source bytes and fitted matrices. Preparation maps native image edges through these matrices, then through SMASH WCS into the shared observation plane. Rebuilding the fixed delivery geometry requires no rerunning of feature detection.

```sh
pnpm install --frozen-lockfile
node labs/nebula/run.mts prepare-overlays
pnpm lab:nebula
```

Missing originals download into the ignored cache and must match their recorded hashes. New previews retain up to 4096 pixels, with native originals retained for future high-resolution processing. Gaia's prepared derivative retains its CC BY-SA 4.0 licence; credits and source links remain in the image panel and provenance.

## Shared angular scale

At the LMC descriptor distance (49.5907 kpc), one arcsecond spans 0.24042 pc. Full SMASH is 9.3293° × 9.0521° between the central edge rays, with a tangent-plane width of 8.1001 kpc. Its native reference-plane scale is 4.99625 arcseconds per pixel; multiplying that plate scale by image width is a tangent-plane approximation, not the exact wide-field angle.

The model's median heliocentric distance is 49.899 kpc. Its projected mass-enclosing diameters are 6.315° (50%), 19.248° (90%), and 28.944° (99%). The original SMASH footprint contains 54.75% of model particles at their reconstructed sky positions. The pinned density transform has unit singular values: no factor-three unit conversion is present. These values are reproducible in `models/lmc/overlays/source/angular-size-receipt.json`.

A wider modeled stellar envelope does not justify stretching a photograph, and it does not explain a particular bright-bar mismatch by itself. Simulation particles are not individually identified observed stars, and displayed density opacity is not photographic surface brightness. Image-to-image star registration supplies angular calibration; image-to-simulation morphology remains a separate comparison.

**Calibrated sky** restores the image's physical sky placement at 100%. The Size slider spans 1–2000%; larger numerical values remain possible. Manual fits remain available, but 300% or 390% changes the angular footprint and is not an astrometric calibration.

Inspection planes use the PolyCSS projective coefficients with no seam dilation and retain floating-point coefficients. Ordinary mesh seam padding had enlarged narrow detail images by about 2.7%; rounded projective terms added smaller distortion. A calibration plane has no neighbouring polygon seam to hide. Known previous placement bases are carried in the recipe so this correction preserves existing saved manual controls.

The separately preserved `source/horalek-manual-placement.json` candidate uses scale 2.165 and Z rotation −136.75°. It reverses photographic landmarks relative to the earlier common 39° fit: Tarantula moves to the opposite end of the central body. The smooth N-body density has no independently identified Tarantula feature to resolve that ambiguity. This candidate is retained for comparison and is not applied as the image-registration default.
