# Dumbbell Nebula

NOIRLab's photograph of the Dumbbell Nebula, standing as one flat picture that faces the Sun at the nebula's distance. **The picture has no depth.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [NOIRLab noao-m27](https://noirlab.edu/public/images/noao-m27/) | [Record](../../sources/noirlab-noao-m27.json). M27, NGC 6853, Dumbbell Nebula: a color composite from the Kitt Peak 2.1-meter telescope; its page names no filters; 1750 × 1500 px over 8.90 × 7.63 arcmin (`source/starless.jpg`: the publisher's picture with its stars removed, restored from the source cache). Credit: REU program/NOIRLab/NSF/AURA. A display composite, not calibrated photometry. |
| Chornay & Walton (2021) | [Record](../../sources/chornay-walton-2021-pn-central-stars.json). Distance: 388 pc (382 to 394). |

## The picture

- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m27-layers`). It predicts the light under a star; it does not measure it. The central star goes with the rest.
- **Registration:** The file's embedded sky tags, used as they are: 0.3053 arcsec per pixel, north 2.1° left of vertical, the frame's centre at 299.9038269°, 22.7212155°. Not measured against Gaia here.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through its centre, so it faces the Sun. The centre is 7.5″ from the nebula's position, which is the recipe's whole inclination (0.002087°). This is where a sky picture lies, not a measured shape.
- **Size:** 8.90 × 7.63 arcmin, 1.00 pc wide at 388 pc.
- **Rim:** the picture fades out on a round rim between 70% and 98% of half its long side; the nebula stands on dark sky, so the long edges show no straight line.

## Known problems

- The picture is flat: seen from the side it is a line. No published three-dimensional shape of the nebula is used yet ([ledger](investigations.json)).
- NOX removed the stars. The glow of the brightest remains, and compact light of the nebula's own can go with them. A second pass over a smaller copy, which takes saturated stars, also took real nebula here, so it is not used.
- Colors are the publisher's display composite, not a measurement.
