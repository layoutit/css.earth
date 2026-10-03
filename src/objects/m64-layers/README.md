# Black Eye Galaxy

A survey image of the Black Eye Galaxy (NGC 4826), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc, with its bulge standing through it as a small volume. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 16.86 × 16.86 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4826 = PGC 44182: centre 194.18201°, +21.68210°, D25 diameter 10.5′ (log d25 2.022), type SABa (T = 2.2). |
| [Leroy et al. (2021), PHANGS-ALMA](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) | [Record](../../sources/leroy-2021-phangs-alma.json). Row NGC4826: inclination 59.1 ± 0.9°, position angle 293.6 ± 1.2°, from the rotation of its gas ([Lang et al. 2020](../../sources/lang-2020-phangs-kinematics.json)). |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 274 Gaia DR3 sources within 0.2108° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 4826's total B-V, 0.84 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 4.36 Mpc (4.30 to 4.42). |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit of NGC4826 (table 7, model `_bdd`): a Sérsic bulge (28.0% of the light, magnitude 9.229, half-light radius 28.96″ = 0.61 kpc, n = 4.164, axis ratio 0.699, PA 102.38°) and an exponential disc (67.9% of the light, scale length 56.23″ = 1.19 kpc, axis ratio 0.554, PA 115.88°, face-on central surface brightness 19.018, 18.377 as projected on the sky) and an exponential disc (4.2% of the light, scale length 17.38″ = 0.37 kpc, axis ratio 0.554, PA 115.88°, face-on central surface brightness 19.486, 18.845 as projected on the sky). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m64-layers`). NOX leaves the wide glow of a bright star: 4 of the 4 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 140 px (47″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.84 in linear light.
- **Bulge:** the bulge takes the fit's own light, scaled to the photograph and never more than the photograph holds there, in an oblate spheroid through the disc with intrinsic axis ratio 0.55 (the one that projects to 0.699 at 59.1°) and the fit's deprojected Sérsic density. The flat picture keeps the rest, so the view from the Sun is unchanged and the photograph's own structure stays on the disc. The spheroid ends on its own surface at 8 half-light radii (4.9 kpc), where the fitted bulge is under about 1% of the display's range, fading from half that radius, so it shows no rim: a presentation choice.
- **Disc:** inclination 59.1°, line of nodes 293.6°, drawn as one flat image on the midplane. The support radius, 8.007 kpc, is 1.2 times the D25 radius (5.3′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 24° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (7, 7, 5) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (7 of 255).

## Known problems

- The bulge's depth is modelled, not measured: the paper fits light on the sky, and the spheroid is the one that shows its axis ratio at the disc's tilt.
- The fit is of the 3.6 µm image and the picture is visible light, so the bulge's share of the picture is not exactly the fit's.
- Where the fit's bulge is as bright as the photograph, the flat picture is empty under it; from the side the nucleus can show as a dark spot on the disc.
- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
