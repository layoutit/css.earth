# M90

A survey image of M90 (NGC 4569), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, stands on a flat plane facing the Sun, with its bulge standing through it as a volume. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 14.58 × 14.58 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4569 = PGC 42089: centre 189.20808°, +13.16339°, D25 diameter 9.1′ (log d25 1.96), type Sab (T = 2.4). |
| [Leroy et al. (2021), PHANGS-ALMA](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) | [Record](../../sources/leroy-2021-phangs-alma.json). Row NGC4569: inclination 70.0 ± 6.0°, position angle 18.0 ± 2.0°, from the rotation of its gas ([Lang et al. 2020](../../sources/lang-2020-phangs-kinematics.json)). |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 208 Gaia DR3 sources within 0.1822° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 4569's total B-V, 0.72 ± 0.02 as observed. |
| Leroy et al. (2021) | [Record](../../sources/leroy-2021-phangs-alma.json). Distance: 15.76 Mpc (13.38 to 18.14). |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit of NGC4569 (table 7, model `_bdbar`): a Sérsic bulge (14.6% of the light, magnitude 11.222, half-light radius 6.52″ = 0.50 kpc, n = 4.898, axis ratio 0.61, PA 16.25°) and an exponential disc (71.4% of the light, scale length 66.14″ = 5.05 kpc, axis ratio 0.407, PA 24.8°, face-on central surface brightness 20.598, 19.622 as projected on the sky) and a Ferrers bar (13.9% of the light, radius 118.84″ = 9.08 kpc, axis ratio 0.221, PA 16.53°, central surface brightness 20.058 on the sky). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m90-layers`). NOX leaves the wide glow of a bright star: 5 of the 5 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 101 px (29″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.72 in linear light.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line, so it faces the Sun. Its disc is tilted 70° (PHANGS), too steep to lay the picture on: a flat picture of a disc seen that close to edge-on would stretch its bulge across the plane. This is where a sky picture lies, not a measured shape.
- **Bulge:** the bulge takes the fit's own light, scaled to the photograph and never more than the photograph holds there, in an oblate spheroid through the picture. The spheroid is flattened along the normal of the galaxy's own disc (Leroy et al. (2021), row NGC4569: inclination 70.0 ± 6.0°, position angle 18.0 ± 2.0°, from the rotation of its gas (Lang et al. 2020)), with intrinsic axis ratio 0.54, the one that projects to 0.61 at 70°, and the fit's deprojected Sérsic density. The flat picture keeps the rest, so the view from the Sun is unchanged. The spheroid ends at 8 half-light radii (3.99 kpc), where the fitted bulge is under about 1% of the display's range, fading from half that radius: a presentation choice.
- **Rim:** the picture fades out on a round rim at 32.75 kpc, 0.98 of its half-width, so no straight edge shows.
- **Sky:** the image's sky, (7, 7, 5) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (7 of 255).

## Known problems

- The bulge's depth is modelled, not measured: the paper fits light on the sky, and the spheroid is the one that shows its axis ratio at the disc's tilt.
- The fit is of the 3.6 µm image and the picture is visible light, so the bulge's share of the picture is not exactly the fit's.
- Only the bulge has depth. The disc, its dust lane and everything else in the picture stay on the flat plane that faces the Sun, so from the side the galaxy is a round glow crossed by a line.
- The picture is flat: seen from the side it is a line.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
