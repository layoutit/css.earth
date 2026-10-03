# Trifid Nebula

ESO's photograph of the Trifid Nebula, standing as one flat picture that faces the Sun at the nebula's distance. **The picture has no depth.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESO eso0930a](https://www.eso.org/public/images/eso0930a/) | [Record](../../sources/eso-eso0930a.json). The Trifid Nebula: B, V, R and H-alpha; 2432 × 2432 px over 13.89 × 13.89 arcmin (`source/starless.jpg`: the window cut from the publisher's picture with its stars removed, restored from the source cache). Credit: ESO. A display composite, not calibrated photometry. |
| Kuhn et al. (2019) | [Record](../../sources/kuhn-2019-young-clusters-gaia.json). Distance: 1,264 pc (1,196 to 1,340). |

## The picture

- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m20-layers --from=source.jpg --coarse=4`). It predicts the light under a star; it does not measure it. NOX then ran again over a copy a quarter of the size (608 x 608 px), where the saturated stars are small enough for it, and the picture took that pass's result where it took a star: 1.86% of the picture.
- **Registration:** The file's embedded sky tags, used as they are: 0.3426 arcsec per pixel, north 0.2° left of vertical, the window's centre at 270.5770458°, -23.0163803°. Not measured against Gaia here.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through its centre, so it faces the Sun. The centre is 81.6″ from the nebula's position, which is the recipe's whole inclination (0.02266°). This is where a sky picture lies, not a measured shape.
- **Size:** 13.89 × 13.89 arcmin, 5.11 pc wide at 1,264 pc.
- **Rim:** the picture fades out on a round rim between 70% and 98% of half its short side, so no straight edge shows.

## Known problems

- The picture is flat: seen from the side it is a line. No published three-dimensional shape of the nebula is used yet ([ledger](investigations.json)).
- NOX removed the stars. Where the second pass took a saturated star, a soft patch a quarter as sharp stands in its place, and compact light of the nebula's own can go with the stars.
- Colors are the publisher's display composite, not a measurement.
