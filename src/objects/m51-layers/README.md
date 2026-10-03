# Whirlpool Galaxy

A survey image of the Whirlpool Galaxy (NGC 5194), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 21.96 × 21.96 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 5194 = PGC 47404: centre 202.46955°, +47.19515°, D25 diameter 13.7′ (log d25 2.137), type SABb (T = 4), inclination 32.6°, position angle 163°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 495 Gaia DR3 sources within 0.2745° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 5194's total B-V, 0.60 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 8.34 Mpc (8.04 to 8.65). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m51-layers`). NOX leaves the wide glow of a bright star: 10 of the 10 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 69 px (30″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.60 in linear light.
- **Disc:** inclination 32.6°, line of nodes 163°, drawn as one flat image on the midplane. The support radius, 19.96 kpc, is 1.2 times the D25 radius (6.9′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 253° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (7, 7, 4) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (7 of 255).

## Dots

| Catalogue | Drawn | Note |
| --- | --- | --- |
| [Star clusters (Chandar et al. 2016)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/824/71), [recipe](source/chandar-clusters/points.json) | 3,812 | compact clusters in Hubble images, with ages and masses in the table |
| [Cepheids (Csörnyei et al. 2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/678/A44), [recipe](source/csornyei-cepheids/points.json) | 638 | the variables behind the galaxy's Cepheid distance |
| [Planetary nebulae (Feldmeier et al. 1997)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/479/231), [recipe](source/feldmeier-pne/points.json) | 63 | the survey for the galaxy's distance; 1 more lie outside the photograph |

The catalogue tables are files of the CDS archive (each descriptor's `table.origin`); they are not tracked. Each dot is a catalogued object at its published sky position, placed where its sight line meets the disc. Its height above the disc is drawn from a 466 pc layer, the scale length over 7.3 ([Kregel et al. 2002](https://arxiv.org/abs/astro-ph/0204154), [record](../../sources/kregel-2002-disc-flattening.json)); that height is not measured. Each dot takes its tone from the image's brightness under it and moves halfway from its kind's color to the image's color there.

## Known problems

- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
