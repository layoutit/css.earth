# Black Eye Galaxy

A survey image of the Black Eye Galaxy (NGC 4826), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 16.86 × 16.86 arcmin, tangent projection, north up (`source/source.jpg`, restored from its origin). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4826 = PGC 44182: centre 194.18201°, +21.68210°, D25 diameter 10.5′ (log d25 2.022), type SABa (T = 2.2). |
| [Leroy et al. (2021), PHANGS-ALMA](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) | [Record](../../sources/leroy-2021-phangs-alma.json). Row NGC4826: inclination 59.1 ± 0.9°, position angle 293.6 ± 1.2°, from the rotation of its gas ([Lang et al. 2020](../../sources/lang-2020-phangs-kinematics.json)). |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 274 Gaia DR3 sources within 0.2108° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). |
| [RC3](../../sources/rc3-1991.json) | NGC 4826's total B-V, 0.84 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 4.36 Mpc (4.30 to 4.42). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Foreground stars:** the bake removes the Gaia foreground stars where they show and leaves those on extended light.
- **Color:** tied to RC3's B-V of 0.84 in linear light.
- **Disc:** inclination 59.1°, line of nodes 293.6°, drawn as one flat image on the midplane. The support radius, 8.007 kpc, is 1.2 times the D25 radius (5.3′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 24° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (7, 7, 5) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (7 of 255).

## Known problems

- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- Fainter and uncatalogued foreground stars remain.
