# Eagle Nebula

ESO's photograph of the Eagle Nebula, standing as one flat picture that faces the Sun at the nebula's distance. The stars of NGC 6611, the cluster inside it, are drawn as dots by the [Eagle Nebula members](../m16-members/README.md) bank. **The picture has no depth.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESO eso0926a](https://www.eso.org/public/images/eso0926a/) | [Record](../../sources/eso-eso0926a.json). The Eagle Nebula: B (451 nm), V (539 nm) and R (651 nm); 4000 × 4000 px over 32.08 × 32.08 arcmin (`source/starless.jpg`: the publisher's picture with its stars removed, restored from the source cache). Credit: ESO. A display composite, not calibrated photometry. |
| Hunt & Reffert (2023) | [Record](../../sources/hunt-reffert-2023-open-clusters.json). Distance: 1,698 pc (1,694 to 1,703). |

## The picture

- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m16-layers --coarse=4`). It predicts the light under a star; it does not measure it. NOX then ran again over a copy a quarter of the size (1000 x 1000 px), where the saturated stars are small enough for it, and the picture took that pass's result where it took a star: 2.71% of the picture.
- **Registration:** The file's embedded sky tags, used as they are: 0.4811 arcsec per pixel, north 0.0° left of vertical, the frame's centre at 274.7059174°, -13.7638973°. Not measured against Gaia here.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through its centre, so it faces the Sun. The centre is 141.6″ from the nebula's position, which is the recipe's whole inclination (0.03932°). This is where a sky picture lies, not a measured shape.
- **Size:** 32.08 × 32.08 arcmin, 15.8 pc wide at 1,698 pc.
- **Rim:** the picture fades out on a round rim between 70% and 98% of half its short side, so no straight edge shows.

## Known problems

- The picture is flat: seen from the side it is a line. No published three-dimensional shape of the nebula is used yet ([ledger](investigations.json)).
- NOX removed the stars. Where the second pass took a saturated star, a soft patch a quarter as sharp stands in its place, and compact light of the nebula's own can go with the stars.
- Colors are the publisher's display composite, not a measurement.
