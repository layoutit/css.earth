# M77

A survey image of M77 (NGC 1068), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 9.78 × 9.78 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 1068 = PGC 10266: centre 40.66973°, -0.01328°, D25 diameter 6.1′ (log d25 1.786), type Sb (T = 3). |
| [Leroy et al. (2021), PHANGS-ALMA](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) | [Record](../../sources/leroy-2021-phangs-alma.json). Row NGC1068: inclination 34.7 ± 5.0°, position angle 72.7 ± 10.0°, from the rotation of its gas ([Lang et al. 2020](../../sources/lang-2020-phangs-kinematics.json)). |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 116 Gaia DR3 sources within 0.1222° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 1068's total B-V, 0.74 ± 0.01 as observed. |
| Leroy et al. (2021) | [Record](../../sources/leroy-2021-phangs-alma.json). Distance: 13.97 Mpc (11.86 to 16.08). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m77-layers`). NOX leaves the wide glow of a bright star: 4 of the 4 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 161 px (31″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.74 in linear light.
- **Disc:** inclination 34.7°, line of nodes 72.7°, drawn as one flat image on the midplane. The support radius, 14.9 kpc, is 1.2 times the D25 radius (3.1′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 163° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (9, 8, 4) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (9 of 255).

## Known problems

- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
