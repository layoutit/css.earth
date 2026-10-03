# NGC 1365

An observatory photograph of NGC 1365, cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc. It has no dots. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [NOIRLab iotw2127a](https://noirlab.edu/public/images/iotw2127a/) | [Record](../../sources/noirlab-iotw2127a.json). Dark Energy Survey data from the Dark Energy Camera on the Blanco 4-metre telescope, processed by T. Rector, J. Miller, M. Zamani and D. de Martin: the publisher's Large JPEG, 3383 × 3263 px (`source/source.jpg`, restored from its origin). CC BY 4.0, credit Dark Energy Survey/DOE/FNAL/DECam/CTIO/NOIRLab/NSF/AURA. The page does not name the filters. A display composite, not calibrated photometry. |
| [Leroy et al. (2021)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) | [Record](../../sources/leroy-2021-phangs-alma.json). Row NGC1365: centre 53.40167°, −36.14028°, inclination 55.4 ± 6.0°, position angle 201.1 ± 7.5°: the disc the image lies on. The same row gives the stellar scale length, 13.1 kpc at their 19.57 Mpc, 138.1″, which is 12.22 kpc at the distance used here. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 278 Gaia DR3 sources within 0.18° of NGC 1365's centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the [Gaia record](../../sources/gaia-2023-dr3.json)). |
| [RC3](../../sources/rc3-1991.json) | NGC 1365's total B-V, 0.69 ± 0.01 as observed. |
| [Riess et al. (2016)](https://arxiv.org/abs/1604.01424) | [Record](../../sources/arxiv-1604-01424.json). Distance: table 5, row N1365, Cepheid distance modulus 31.307 ± 0.057, 18.26 Mpc, the distance its Cepheids are placed at. |
| [Kregel et al. (2002)](https://arxiv.org/abs/astro-ph/0204154) | [Record](../../sources/kregel-2002-disc-flattening.json). Discs are on average 7.3 ± 2.2 times longer than thick, so the scale length gives a 1674 pc scale height. The recipe carries six of them as the disc's thickness; a flat bank draws none of it. |

The bank has no parent: it is the picture of its host, [`ngc-1365`](../ngc-1365/README.md), named in `properties.host`. The host's README says which object the galaxy is inside.

## The image

- **Registration:** the page's centre (53.40417°, −36.14565°), field (14.82 × 14.30′) and orientation (north up) hold: 72 of the 90 Gaia stars brighter than G = 19 in the frame have a star within 4 px of their places, and a search over centre, scale, rotation and mirror finds nothing better than 73. That is 0.263″ per pixel. Leroy et al.'s centre lands in the bright central region, whose core is burned out in the photograph, so no nucleus peak can be measured against it.
- **Foreground stars:** 144 of the 162 Gaia foreground stars in the image are removed where they show; 0 on extended
  light are left.
- **Color:** tied to RC3's B-V of 0.69: red/green 1.063 and blue/green 1.01 against 1.148 and 0.873, so red × 1.08
  and blue × 0.864 in linear light.
- **Disc:** inclination 55.4°, line of nodes 201.1°, drawn as one flat image on the midplane. The support radius, 37.9 kpc (7.1′), is where the frame stops on its tightest side. The image's ring median is still 13 of 255 there, above its sky level of 4, so the frame cuts the faintest outer light; RC3's isophotal radius is 29.8 kpc.
- **Near side:** the catalogue gives the tilt, not which edge is nearer. The arms open counter-clockwise on the sky, so if they trail, as spiral arms do, the disc turns clockwise; with the receding side at position angle 201.1° that puts the near side at 291° (west-north-west). This is an inference from the photograph and the velocity field, not a published statement. It reads Leroy et al.'s position angle as the receding side's; [Lang et al. (2020)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/897/122) fit 210.7° to the CO velocity field, the same side.
- **Sky:** the image's sky, (4, 3, 4) of 255, is subtracted as the background floor (4 of 255).
- **Bytes:** one image, 625 × 907 px, 217 KB (WebP quality 70, alpha quality 80), the scale of the Milky Way's own
  backing image. It is one flat plane, as the Milky Way's is: no slabs through the disc's thickness.

## Evidence

![The arrival view of NGC 1365](evidence/2026-10-02/arrival.jpg)

The NGC 1365 page's opening view in headless Chromium at 1440 × 900, device pixel ratio 2, on this branch on 2026-10-02. The white dots on the disc are
its SH0ES Cepheids, objects of their own inside the galaxy.

- The prepared bank's `approximation.limitations` records the foreground and color-tie counts quoted above.
- What was examined and left out is in the [investigation ledger](investigations.json).

## Measured, chosen and inferred

| Value | Kind |
| --- | --- |
| Centre, inclination 55.4° ± 6.0°, position angle 201.1° ± 7.5° | Measured: Leroy et al. (2021) |
| Distance 18.26 Mpc | Measured: Riess et al. (2016), from its Cepheids |
| Near side at 291° | Inferred: trailing arms and the receding side |
| B-V 0.69 | Measured: RC3 |
| Scale height 1674 pc | Inferred: the scale length over 7.3, the mean of other galaxies; not measured here, and not drawn |
| Support 37.9 kpc, fade from 28.4 kpc | Presentation: where the frame stops |
| One flat image, at most 1,024 px on its face, background floor | Presentation |

## Known problems

- The tilt and position angle are loosely measured (± 6° and ± 7.5°), so the disc's orientation in space is uncertain by about that much.
- The frame cuts the faintest outer light on its tightest side.
- The galaxy's core is burned out in the photograph.
- The field's stars and background galaxies inside the support radius are drawn on the disc's plane with the rest of the image.
- No dots: the PHANGS-MUSE nebular catalogue lists 1,449 nebulae here ([Groves et al. 2023](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/520/4902)); they are not drawn in this change.
- The scale length behind the recipe's thickness, 13.1 kpc, is the largest in Leroy et al.'s table; a flat bank does not draw it.
- The image is flat: seen edge-on it is a line. Nothing here has height.
