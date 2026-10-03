# Ring Nebula

ESA/Hubble's photograph of the Ring Nebula, standing as one flat picture that faces the Sun at the nebula's distance. **The picture has no depth.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESA/Hubble heic1310a](https://esahubble.org/images/heic1310a/) | [Record](../../sources/esahubble-heic1310a.json). Hubble image of the Ring Nebula (Messier 57): He II 469, H-beta 487, [O III] 502, continuum 645, H-alpha 656, [N II] 658 and [S II] 673 nm; 3179 × 3179 px over 2.10 × 2.10 arcmin (`source/starless.jpg`: the publisher's picture with its stars removed, restored from the source cache). Credit: NASA, ESA, and C. Robert O'Dell (Vanderbilt University). A display composite, not calibrated photometry. |
| Chornay & Walton (2021) | [Record](../../sources/chornay-walton-2021-pn-central-stars.json). Distance: 790 pc (764 to 818). |

## The picture

- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m57-layers`). It predicts the light under a star; it does not measure it. The central star goes with the rest.
- **Registration:** The file's embedded sky tags, used as they are: 0.0396 arcsec per pixel, north 11.7° left of vertical, the frame's centre at 283.3967177°, 33.0289252°. Not measured against Gaia here.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through its centre, so it faces the Sun. The centre is 1.6″ from the nebula's position, which is the recipe's whole inclination (0.001°). This is where a sky picture lies, not a measured shape.
- **Size:** 2.10 × 2.10 arcmin, 0.48 pc wide at 790 pc.
- **Rim:** the picture fades out on a round rim between 70% and 98% of half its short side, so no straight edge shows.

## Known problems

- The picture is flat: seen from the side it is a line. No published three-dimensional shape of the nebula is used yet ([ledger](investigations.json)).
- NOX removed the stars. The glow of the brightest remains, and compact light of the nebula's own can go with them. A second pass over a smaller copy, which takes saturated stars, also took real nebula here, so it is not used.
- Colors are the publisher's display composite, not a measurement.
