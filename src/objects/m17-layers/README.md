# Omega Nebula

ESO's photograph of the Omega Nebula, standing as one flat picture that faces the Sun at the nebula's distance. **The picture has no depth.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESO eso1537a](https://www.eso.org/public/images/eso1537a/) | [Record](../../sources/eso-eso1537a.json). The star formation region Messier 17: B, V, R and H-alpha; 4000 × 3738 px over 35.44 × 33.12 arcmin (`source/starless.jpg`: the publisher's picture with its stars removed, restored from the source cache). Credit: ESO. A display composite, not calibrated photometry. |
| Kuhn et al. (2019) | [Record](../../sources/kuhn-2019-young-clusters-gaia.json). Distance: 1,680 pc (1,570 to 1,810). |

## The picture

- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m17-layers`). It predicts the light under a star; it does not measure it.
- **Registration:** The file's embedded sky tags, used as they are: 0.5316 arcsec per pixel, north 0.0° left of vertical, the frame's centre at 275.2630836°, -16.1874792°. Not measured against Gaia here.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through its centre, so it faces the Sun. The centre is 499.3″ from the nebula's position, which is the recipe's whole inclination (0.1387°). This is where a sky picture lies, not a measured shape.
- **Size:** 35.44 × 33.12 arcmin, 17.3 pc wide at 1,680 pc.
- **Rim:** the picture fades out on a round rim between 70% and 98% of half its short side, so no straight edge shows.

## Known problems

- The picture is flat: seen from the side it is a line. No published three-dimensional shape of the nebula is used yet ([ledger](investigations.json)).
- NOX removed the stars. The glow of the brightest remains, and compact light of the nebula's own can go with them. A second pass over a smaller copy, which takes saturated stars, also took real nebula here, so it is not used.
- Colors are the publisher's display composite, not a measurement.
