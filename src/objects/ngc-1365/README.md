# NGC 1365

NGC 1365 as an object of the world: its place, its card and its list marker. It has no surface. Its dataset shows the [NGC 1365 image layers](../ngc-1365-layers/README.md) bank, whose README holds the sources, processing, evidence and known problems of the imagery.

NGC 1365 is one of the 19 galaxies in which the Hubble Space Telescope found Cepheids to set the brightness of a Type Ia supernova
for the Hubble constant (Riess et al. 2016). Its 81 Cepheids (`src/objects/ngc-1365-cepheid-*`) are objects inside it and are placed
at the same distance.

## Sources

| Source | Measurement used |
| --- | --- |
| [Riess et al. (2016)](https://arxiv.org/abs/1604.01424) ([record](../../sources/arxiv-1604-01424.json)) | Table 5, row N1365 (SN 2012fr): Cepheid distance modulus μ = 31.307 ± 0.057 mag, so 10^(μ/5 + 1) pc = 18.26 Mpc. The same distance places its Cepheids ([sh0es.mts](../../../packages/telescope-cli/src/new-object/archives/sh0es.mts)). |
| [Leroy et al. (2021)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) ([record](../../sources/leroy-2021-phangs-alma.json)) | Row NGC1365: centre 53.40167°, −36.14028°, inclination 55.4 ± 6.0°: the card's tilt. |
| [RC3](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/155) ([record](../../sources/rc3-1991.json)) | Type SB(s)b (`.SBS3..`): barred; log D25 = 2.05, the framing radius. |
| [Cosmicflows-4, Tully et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) ([record](../../sources/cosmicflows-4.json)) | Which object it is inside: Table2 row PGC 13179 belongs to group 1PGC 13418, the group of NGC 1399: the Fornax Cluster, so its parent is `fornax-cluster`. |
| SIMBAD | Radial velocity, as in the [astronomy record](../../../packages/astronomy/data/bodies/ngc-1365.json). |

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json).

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/ngc-1365.json) places it at the position and distance of the sources above, with SIMBAD's radial velocity.
2. `node packages/bake/cli/prepare-image-layers.mts src/objects/ngc-1365-layers` bakes the image bank from its [recipe](../ngc-1365-layers/source/recipe.json), and `node site/build/prepare/prepare-volume-presentation.mts --object=ngc-1365-layers` prepares its dataset card.
3. `node packages/bake/cli/prepare-object.mts ngc-1365` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame. The page frames it at 29,800 pc, RC3's isophotal radius (half of D25, log D25 = 2.05 in 0.1′) at the Cepheid distance ([solar-system.json](source/presentation/solar-system.json)).
4. `node site/build/prepare/companion-context.mts ngc-1365` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is RC3's isophotal radius, a measure of where the disc fades below a surface brightness, not the galaxy's full extent.
- The radial velocity is SIMBAD's for the whole galaxy; the galaxy is held at its catalogued position with no motion across the sky.
