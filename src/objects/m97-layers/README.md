# Owl Nebula

A survey image of the Owl Nebula, standing as one flat picture that faces the Sun at the nebula's distance. **The picture has no depth.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://alasky.cds.unistra.fr/MocServer/query?ID=CDS%2FP%2FSDSS9%2Fcolor&get=record) | [Record](../../sources/sdss-dr9-color-hips.json). SDSS9 color: SDSS g, r and i; 2000 × 2000 px over 7.20 × 7.20 arcmin (`source/starless.jpg`: the publisher's picture with its stars removed, restored from the source cache). Credit: Sloan Digital Sky Survey; color HiPS CDS/P/SDSS9/color by T. Boch (CDS), cut out by the CDS hips2fits service. A display composite, not calibrated photometry. |
| Chornay & Walton (2021) | [Record](../../sources/chornay-walton-2021-pn-central-stars.json). Distance: 811 pc (782 to 842). |

## The picture

- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m97-layers --coarse=4`). It predicts the light under a star; it does not measure it. NOX then ran again over a copy a quarter of the size (500 x 500 px), where the saturated stars are small enough for it, and the picture took that pass's result where it took a star: 2.33% of the picture. The central star goes with the rest.
- **Registration:** The cutout's registration is its request: a tangent projection centred on the nebula's central star, north up.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through its centre, so it faces the Sun. The centre is 0.0″ from the nebula's position, which is the recipe's whole inclination (0.001°). This is where a sky picture lies, not a measured shape.
- **Size:** 7.20 × 7.20 arcmin, 1.70 pc wide at 811 pc.
- **Rim:** the picture fades out on a round rim between 70% and 98% of half its short side, so no straight edge shows.

## Known problems

- The picture is flat: seen from the side it is a line. No published three-dimensional shape of the nebula is used yet ([ledger](investigations.json)).
- NOX removed the stars. Where the second pass took a saturated star, a soft patch a quarter as sharp stands in its place, and compact light of the nebula's own can go with the stars.
- Colors are the publisher's display composite, not a measurement.
