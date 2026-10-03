# NGC 4639

NGC 4639 as an object of the world: its place, its card and its list marker. It has no surface. Its dataset shows the [NGC 4639 image layers](../ngc-4639-layers/README.md) bank, whose README holds the sources, processing, evidence and known problems of the imagery.

NGC 4639 is one of the 19 galaxies in which the Hubble Space Telescope found Cepheids to set the brightness of a Type Ia supernova
for the Hubble constant (Riess et al. 2016). Its 32 Cepheids (`src/objects/ngc-4639-cepheid-*`) are objects inside it and are placed
at the same distance.

## Sources

| Source | Measurement used |
| --- | --- |
| [Riess et al. (2016)](https://arxiv.org/abs/1604.01424) ([record](../../sources/arxiv-1604-01424.json)) | Table 5, row N4639 (SN 1990N): Cepheid distance modulus μ = 31.532 ± 0.071 mag, so 10^(μ/5 + 1) pc = 20.25 Mpc. The same distance places its Cepheids ([sh0es.mts](../../../packages/telescope-cli/src/new-object/sh0es.mts)). |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) ([record](../../sources/hyperleda-2014.json)) | Meandata row PGC 42741: centre 190.71834°, 13.25724° (al2000 12.7145558 h), inclination 51.02°: the card's tilt. It is not in Leroy et al.'s PHANGS table. |
| [RC3](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/155) ([record](../../sources/rc3-1991.json)) | Type SAB(rs)bc (`.SXT4..`): between unbarred and barred; log D25 = 1.44, the framing radius. |
| [Cosmicflows-4, Tully et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) ([record](../../sources/cosmicflows-4.json)) | Which object it is inside: Table2 row PGC 42741 is its own group, 1PGC 42741, with no other member listed, so no group places it in a cluster and its parent is `nearby-universe`. |
| SIMBAD | Radial velocity, as in the [astronomy record](../../../packages/astronomy/data/bodies/ngc-4639.json). |

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json).

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/ngc-4639.json) places it at the position and distance of the sources above, with SIMBAD's radial velocity.
2. `node packages/bake/cli/prepare-image-layers.mts src/objects/ngc-4639-layers` bakes the image bank from its [recipe](../ngc-4639-layers/source/recipe.json), and `node site/build/prepare/prepare-volume-presentation.mts --object=ngc-4639-layers` prepares its dataset card.
3. `node packages/bake/cli/prepare-object.mts ngc-4639` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame. The page frames it at 8,100 pc, RC3's isophotal radius (half of D25, log D25 = 1.44 in 0.1′) at the Cepheid distance ([solar-system.json](source/presentation/solar-system.json)).
4. `node site/build/prepare/companion-context.mts ngc-4639` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is RC3's isophotal radius, a measure of where the disc fades below a surface brightness, not the galaxy's full extent.
- The radial velocity is SIMBAD's for the whole galaxy; the galaxy is held at its catalogued position with no motion across the sky.
