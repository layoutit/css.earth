# M96

A survey image of M96 (NGC 3368), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 13.20 × 13.20 arcmin, tangent projection, north up (`source/source.jpg`, restored from its origin). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 3368 = PGC 32192: centre 161.69041°, +11.81992°, D25 diameter 8.3′ (log d25 1.917), type Sab (T = 2.1), inclination 51.07°, position angle 4.57°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 183 Gaia DR3 sources within 0.165° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). |
| [RC3](../../sources/rc3-1991.json) | NGC 3368's total B-V, 0.86 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 10.45 Mpc (10.24 to 10.67). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Foreground stars:** the bake removes the Gaia foreground stars where they show and leaves those on extended light.
- **Color:** tied to RC3's B-V of 0.86 in linear light.
- **Disc:** inclination 51.07°, line of nodes 4.57°, drawn as one flat image on the midplane. The support radius, 15.07 kpc, is 1.2 times the D25 radius (4.1′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 95° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (9, 8, 5) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (9 of 255).

## Known problems

- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- Fainter and uncatalogued foreground stars remain.
