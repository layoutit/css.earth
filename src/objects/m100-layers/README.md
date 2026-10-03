# M100

A survey image of M100 (NGC 4321), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc, with its bulge standing through it as a small volume. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 9.78 × 9.78 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4321 = PGC 40153: centre 185.72867°, +15.82225°, D25 diameter 6.1′ (log d25 1.785), type SABb (T = 4). |
| [Leroy et al. (2021), PHANGS-ALMA](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) | [Record](../../sources/leroy-2021-phangs-alma.json). Row NGC4321: inclination 38.5 ± 2.4°, position angle 156.2 ± 1.7°, from the rotation of its gas ([Lang et al. 2020](../../sources/lang-2020-phangs-kinematics.json)). |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 99 Gaia DR3 sources within 0.1222° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 4321's total B-V, 0.70 ± 0.01 as observed. |
| Leroy et al. (2021) | [Record](../../sources/leroy-2021-phangs-alma.json). Distance: 15.21 Mpc (14.71 to 15.71). |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit of NGC4321 (table 7, model `_bd`): a Sérsic bulge (9.8% of the light, magnitude 11.424, half-light radius 9.58″ = 0.71 kpc, n = 0.639, axis ratio 0.795, PA 127.67°) and an exponential disc (90.2% of the light, scale length 61.14″ = 4.51 kpc, axis ratio 0.823, PA 158.22°, face-on central surface brightness 19.942, 19.73 as projected on the sky). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m100-layers`). NOX leaves the wide glow of a bright star: 3 of the 3 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 87 px (17″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.70 in linear light.
- **Bulge:** the bulge takes the fit's own light, scaled to the photograph and never more than the photograph holds there, in an oblate spheroid through the disc with intrinsic axis ratio 0.22 (the one that projects to 0.795 at 38.5°) and the fit's deprojected Sérsic density. The flat picture keeps the rest, so the view from the Sun is unchanged and the photograph's own structure stays on the disc. The spheroid ends on its own surface at 8 half-light radii (5.65 kpc), where the fitted bulge is under about 1% of the display's range, fading from half that radius, so it shows no rim: a presentation choice.
- **Disc:** inclination 38.5°, line of nodes 156.2°, drawn as one flat image on the midplane. The support radius, 16.18 kpc, is 1.2 times the D25 radius (3.0′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 246° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (12, 11, 8) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (12 of 255).

## Known problems

- The bulge's depth is modelled, not measured: the paper fits light on the sky, and the spheroid is the one that shows its axis ratio at the disc's tilt.
- The fit is of the 3.6 µm image and the picture is visible light, so the bulge's share of the picture is not exactly the fit's.
- Where the fit's bulge is as bright as the photograph, the flat picture is empty under it; from the side the nucleus can show as a dark spot on the disc.
- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
