# NGC 4536

NGC 4536 as an object of the world: its place, its card and its list marker. It has no surface. Its dataset shows the [NGC 4536 image layers](../ngc-4536-layers/README.md) bank, whose README holds the sources, processing, evidence and known problems of the imagery.

NGC 4536 is one of the 19 galaxies in which the Hubble Space Telescope found Cepheids to set the brightness of a Type Ia supernova
for the Hubble constant (Riess et al. 2016). Its 48 Cepheids (`src/objects/ngc-4536-cepheid-*`) are objects inside it and are placed
at the same distance.

## Sources

| Source | Measurement used |
| --- | --- |
| [Riess et al. (2016)](https://arxiv.org/abs/1604.01424) ([record](../../sources/arxiv-1604-01424.json)) | Table 5, row N4536 (SN 1981B): Cepheid distance modulus μ = 30.906 ± 0.053 mag, so 10^(μ/5 + 1) pc = 15.18 Mpc. The same distance places its Cepheids ([sh0es.mts](../../../packages/telescope-cli/src/new-object/archives/sh0es.mts)). |
| [Leroy et al. (2021)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) ([record](../../sources/leroy-2021-phangs-alma.json)) | Row NGC4536: centre 188.61292°, 2.18833°, inclination 66.0 ± 2.9°: the card's tilt. |
| [RC3](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/155) ([record](../../sources/rc3-1991.json)) | Type SAB(rs)bc (`.SXT4..`): between unbarred and barred; log D25 = 1.88, the framing radius. |
| [Cosmicflows-4, Tully et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) ([record](../../sources/cosmicflows-4.json)) | Which object it is inside: Table2 has no row for PGC 41823 (checked by PGC number and within 0.3° of its centre), so no group places it in a cluster and its parent is `nearby-universe`. |
| SIMBAD | Radial velocity, as in the [astronomy record](../../../packages/astronomy/data/bodies/ngc-4536.json). |

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json).

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/ngc-4536.json) places it at the position and distance of the sources above, with SIMBAD's radial velocity.
2. `node packages/bake/cli/prepare-image-layers.mts src/objects/ngc-4536-layers` bakes the image bank from its [recipe](../ngc-4536-layers/source/recipe.json), and `node site/build/prepare/prepare-volume-presentation.mts --object=ngc-4536-layers` prepares its dataset card.
3. `node packages/bake/cli/prepare-object.mts ngc-4536` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame. The page frames it at 16,700 pc, RC3's isophotal radius (half of D25, log D25 = 1.88 in 0.1′) at the Cepheid distance ([solar-system.json](source/presentation/solar-system.json)).
4. `node site/build/prepare/companion-context.mts ngc-4536` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is RC3's isophotal radius, a measure of where the disc fades below a surface brightness, not the galaxy's full extent.
- The radial velocity is SIMBAD's for the whole galaxy; the galaxy is held at its catalogued position with no motion across the sky.
