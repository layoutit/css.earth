# M91

A survey image of M91 (NGC 4548), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc, with its bulge standing through it as a small volume. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 8.88 × 8.88 arcmin, tangent projection, north up (`source/source.jpg`, restored from its origin). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4548 = PGC 41934: centre 188.86036°, +14.49607°, D25 diameter 5.5′ (log d25 1.744), type Sb (T = 3.1). |
| [Leroy et al. (2021), PHANGS-ALMA](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) | [Record](../../sources/leroy-2021-phangs-alma.json). Row NGC4548: inclination 38.3 ± 6.0°, position angle 138.0 ± 2.0°, from the rotation of its gas ([Lang et al. 2020](../../sources/lang-2020-phangs-kinematics.json)). |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 82 Gaia DR3 sources within 0.111° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). |
| [RC3](../../sources/rc3-1991.json) | NGC 4548's total B-V, 0.81 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 16.19 Mpc (15.83 to 16.55). |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit of NGC4548 (table 7, model `_bdbarf`): a Sérsic bulge (10.5% of the light, magnitude 12.0, half-light radius 5.7″ = 0.45 kpc, n = 2.56, axis ratio 0.869, PA 115.78°) and an exponential disc (78.0% of the light, scale length 55.9″ = 4.39 kpc, axis ratio 0.777, PA 149.2°, face-on central surface brightness 20.559, 20.285 as projected on the sky) and a Ferrers bar (11.4% of the light, radius 62.25″ = 4.89 kpc, axis ratio 0.458, PA 63.77°, central surface brightness 20.084 on the sky). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Foreground stars:** the bake removes the Gaia foreground stars where they show and leaves those on extended light.
- **Color:** tied to RC3's B-V of 0.81 in linear light.
- **Bulge:** S4G's fit splits the light at each point between the bulge and the rest (disc and bar). The bulge's share leaves the flat picture and fills an oblate spheroid through the disc, with intrinsic axis ratio 0.60 (the one that projects to 0.869 at 38.3°), following the fit's deprojected Sérsic density, so the view from the Sun is unchanged. The spheroid ends at 3.3 half-light radii on the sky (1.48 kpc); its share fades to nothing from half that radius, and it reaches two thirds of that radius either side of the disc. Those three are M81's proportions, presentation choices.
- **Disc:** inclination 38.3°, line of nodes 138°, drawn as one flat image on the midplane. The support radius, 15.67 kpc, is 1.2 times the D25 radius (2.8′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 228° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (9, 8, 6) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (9 of 255).

## Known problems

- The bulge's depth is modelled from the fit, not measured: the picture's light along our sight lines, spread through the fitted spheroid.
- Where the survey image is saturated at the centre, the fit's own light stands in, so the bulge's core is plainer than the photograph.
- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- Fainter and uncatalogued foreground stars remain.
