# M96

A survey image of M96 (NGC 3368), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 13.20 × 13.20 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 3368 = PGC 32192: centre 161.69041°, +11.81992°, D25 diameter 8.3′ (log d25 1.917), type Sab (T = 2.1), inclination 51.07°, position angle 4.57°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 183 Gaia DR3 sources within 0.165° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 3368's total B-V, 0.86 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 10.45 Mpc (10.24 to 10.67). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m96-layers`). NOX leaves the wide glow of a bright star: 5 of the 5 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 55 px (15″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.86 in linear light.
- **Disc:** inclination 51.07°, line of nodes 4.57°, drawn as one flat image on the midplane. The support radius, 15.07 kpc, is 1.2 times the D25 radius (4.1′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 95° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (9, 8, 5) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (9 of 255).

## Dots

| Catalogue | Drawn | Note |
| --- | --- | --- |
| [Planetary nebulae (Feldmeier et al. 1997)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/479/231), [recipe](source/feldmeier-pne/points.json) | 56 | the survey for the galaxy's distance; 18 more lie outside the photograph |

The catalogue tables are files of the CDS archive (each descriptor's `table.origin`); they are not tracked. Each dot is a catalogued object at its published sky position, placed where its sight line meets the disc. No height above the disc is drawn: no published scale length was found for this disc. Each dot takes its tone from the image's brightness under it and moves halfway from its kind's color to the image's color there.

## Known problems

- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
