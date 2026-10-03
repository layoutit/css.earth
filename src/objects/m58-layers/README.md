# M58

A survey image of M58 (NGC 4579), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 8.04 × 8.04 arcmin, tangent projection, north up (`source/source.jpg`, restored from its origin). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4579 = PGC 42168: centre 189.43138°, +11.81813°, D25 diameter 5.0′ (log d25 1.7), type Sb (T = 2.8). |
| [Leroy et al. (2021), PHANGS-ALMA](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) | [Record](../../sources/leroy-2021-phangs-alma.json). Row NGC4579: inclination 40.2 ± 5.6°, position angle 91.3 ± 1.6°, from the rotation of its gas ([Lang et al. 2020](../../sources/lang-2020-phangs-kinematics.json)). |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 56 Gaia DR3 sources within 0.1005° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). |
| [RC3](../../sources/rc3-1991.json) | NGC 4579's total B-V, 0.82 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 19.52 Mpc (18.30 to 20.82). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Foreground stars:** the bake removes the Gaia foreground stars where they show and leaves those on extended light.
- **Color:** tied to RC3's B-V of 0.82 in linear light.
- **Disc:** inclination 40.2°, line of nodes 91.3°, drawn as one flat image on the midplane. The support radius, 17.07 kpc, is 1.2 times the D25 radius (2.5′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 181° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (9, 9, 6) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (9 of 255).

## Known problems

- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- Fainter and uncatalogued foreground stars remain.
