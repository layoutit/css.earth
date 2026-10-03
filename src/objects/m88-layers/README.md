# M88

A survey image of M88 (NGC 4501), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc, with its bulge standing through it as a small volume. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 13.86 × 13.86 arcmin, tangent projection, north up (`source/source.jpg`, restored from its origin). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4501 = PGC 41517: centre 187.99706°, +14.42004°, D25 diameter 8.6′ (log d25 1.937), type Sb (T = 3.3), inclination 62.95°, position angle 138.25°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 185 Gaia DR3 sources within 0.1733° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). |
| [RC3](../../sources/rc3-1991.json) | NGC 4501's total B-V, 0.73 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 19.45 Mpc (16.26 to 23.28). |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit of NGC4501 (table 7, model `_bd`): a Sérsic bulge (5.9% of the light, magnitude 11.807, half-light radius 5.24″ = 0.49 kpc, n = 2.081, axis ratio 0.674, PA 136.87°) and an exponential disc (94.1% of the light, scale length 39.66″ = 3.74 kpc, axis ratio 0.506, PA 142.56°, central surface brightness 18.781). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Foreground stars:** the bake removes the Gaia foreground stars where they show and leaves those on extended light.
- **Color:** tied to RC3's B-V of 0.73 in linear light.
- **Bulge:** S4G's fit splits the light at each point between bulge and disc. The bulge's share leaves the flat picture and fills an oblate spheroid through the disc, with intrinsic axis ratio 0.56 (the one that projects to 0.674 at 62.95°), following the fit's deprojected Sérsic density, so the view from the Sun is unchanged. The spheroid ends at 3.3 half-light radii on the sky (1.63 kpc); its share fades to nothing from half that radius, and it reaches two thirds of that radius either side of the disc. Those three are M81's proportions, presentation choices.
- **Disc:** inclination 62.95°, line of nodes 138.25°, drawn as one flat image on the midplane. The support radius, 29.37 kpc, is 1.2 times the D25 radius (4.3′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 228° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (7, 8, 6) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (8 of 255).

## Known problems

- The bulge's depth is modelled from the fit, not measured: the picture's light along our sight lines, spread through the fitted spheroid.
- Where the survey image is saturated at the centre, the fit's own light stands in, so the bulge's core is plainer than the photograph.
- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- Fainter and uncatalogued foreground stars remain.
