# M94

A survey image of M94 (NGC 4736), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc, with its bulge standing through it as a small volume. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 12.42 × 12.42 arcmin, tangent projection, north up (`source/source.jpg`, restored from its origin). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4736 = PGC 43495: centre 192.72125°, +41.12030°, D25 diameter 7.7′ (log d25 1.889), type SABa (T = 2.3), inclination 31.77°, position angle 105°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 178 Gaia DR3 sources within 0.1552° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). |
| [RC3](../../sources/rc3-1991.json) | NGC 4736's total B-V, 0.75 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 4.34 Mpc (4.26 to 4.42). |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit of NGC4736 (table 7, model `_bdd`): a Sérsic bulge (42.0% of the light, magnitude 8.378, half-light radius 19.1″ = 0.40 kpc, n = 1.814, axis ratio 0.963, PA 7.53°) and an exponential disc (36.9% of the light, scale length 50.47″ = 1.06 kpc, axis ratio 0.732, PA 96.08°, face-on central surface brightness 19.035, 18.696 as projected on the sky) and an exponential disc (21.1% of the light, scale length 253.87″ = 5.34 kpc, axis ratio 0.829, PA 123.51°, face-on central surface brightness 23.007, 22.803 as projected on the sky). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Foreground stars:** the bake removes the Gaia foreground stars where they show and leaves those on extended light.
- **Color:** tied to RC3's B-V of 0.75 in linear light.
- **Bulge:** S4G's fit splits the light at each point between the bulge and the rest (disc). The bulge's share leaves the flat picture and fills an oblate spheroid through the disc, with intrinsic axis ratio 0.86 (the one that projects to 0.963 at 31.77°), following the fit's deprojected Sérsic density, so the view from the Sun is unchanged. The spheroid ends at 3.3 half-light radii on the sky (1.33 kpc); its share fades to nothing from half that radius, and it reaches two thirds of that radius either side of the disc. Those three are M81's proportions, presentation choices.
- **Disc:** inclination 31.77°, line of nodes 105°, drawn as one flat image on the midplane. The support radius, 5.862 kpc, is 1.2 times the D25 radius (3.9′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 195° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (21, 20, 14) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (21 of 255).

## Known problems

- The bulge's depth is modelled from the fit, not measured: the picture's light along our sight lines, spread through the fitted spheroid.
- Where the survey image is saturated at the centre, the fit's own light stands in, so the bulge's core is plainer than the photograph.
- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- Fainter and uncatalogued foreground stars remain.
