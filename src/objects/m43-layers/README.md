# M43

NOIRLab's photograph of M43, standing as one flat picture that faces the Sun at the nebula's distance. **The picture has no depth.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [NOIRLab noao-m43](https://noirlab.edu/public/images/noao-m43/) | [Record](../../sources/noirlab-noao-m43.json). M43, NGC 1982: a color composite; its page names no filters; 1400 × 1400 px over 6.95 × 6.95 arcmin (`source/starless.jpg`: the publisher's picture with its stars removed, restored from the source cache). Credit: N.A.Sharp/NOIRLab/NSF/AURA. A display composite, not calibrated photometry. |
| Menten et al. (2007) | [Record](../../sources/menten-2007.json). Distance: 414 pc (407 to 421). |

## The picture

- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m43-layers`). It predicts the light under a star; it does not measure it.
- **Registration:** The file's embedded sky tags, used as they are: 0.2979 arcsec per pixel, north 0.4° right of vertical, the frame's centre at 83.8792279°, -5.2667566°. Not measured against Gaia here.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through its centre, so it faces the Sun. The centre is 11.7″ from the nebula's position, which is the recipe's whole inclination (0.003244°). This is where a sky picture lies, not a measured shape.
- **Size:** 6.95 × 6.95 arcmin, 0.84 pc wide at 414 pc.
- **Rim:** the picture fades out on a round rim between 70% and 98% of half its short side, so no straight edge shows.

## Known problems

- The picture is flat: seen from the side it is a line. No published three-dimensional shape of the nebula is used yet ([ledger](investigations.json)).
- NOX removed the stars. The glow of the brightest remains, and compact light of the nebula's own can go with them. A second pass over a smaller copy, which takes saturated stars, also took real nebula here, so it is not used.
- Colors are the publisher's display composite, not a measurement.
