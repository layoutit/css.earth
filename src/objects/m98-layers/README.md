# M98

A survey image of M98 (NGC 4192), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, stands on a flat plane facing the Sun, with its bulge standing through it as a volume. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 17.64 × 17.64 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4192 = PGC 39028: centre 183.45143°, +14.89997°, D25 diameter 11.0′ (log d25 2.043), type SABb (T = 2.6), inclination 90°, position angle 152.4°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 293 Gaia DR3 sources within 0.2205° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 4192's total B-V, 0.81 ± 0.02 as observed. |
| Tully | [Record](../../sources/publication-tully2016aj-152-50t.json). Distance: 17.62 Mpc (14.32 to 21.68). |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit of NGC4192 (table 7, model `_bdd`): a Sérsic bulge (15.7% of the light, magnitude 11.363, half-light radius 6.66″ = 0.57 kpc, n = 2.45, axis ratio 0.443, PA 154.14°) and an exponential disc (40.6% of the light, scale length 87.64″ = 7.49 kpc, axis ratio 0.309, PA 156.34°, face-on central surface brightness 22.036, 20.761 as projected on the sky) and a Ferrers component (43.7% of the light, radius 232.16″ = 19.83 kpc, axis ratio 0.180, PA 150.48°, central surface brightness 20.271 on the sky). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m98-layers`). NOX leaves the wide glow of a bright star: 7 of the 7 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 120 px (42″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.81 in linear light.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line, so it faces the Sun. Its disc is tilted 90° (HyperLEDA), too steep to lay the picture on: a flat picture of a disc seen that close to edge-on would stretch its bulge across the plane. This is where a sky picture lies, not a measured shape.
- **Bulge:** the bulge takes the fit's own light, scaled to the photograph and never more than the photograph holds there, in an oblate spheroid through the picture. The spheroid is flattened along the normal of the galaxy's own disc (HyperLEDA, NGC 4192 = PGC 39028: inclination 90°, position angle 152.4°), with intrinsic axis ratio 0.44, the one that projects to 0.443 at 90°, and the fit's deprojected Sérsic density. The flat picture keeps the rest, so the view from the Sun is unchanged. The spheroid ends at 8 half-light radii (4.55 kpc), where the fitted bulge is under about 1% of the display's range, fading from half that radius: a presentation choice.
- **Rim:** the picture fades out on a round rim at 44.3 kpc, 0.98 of its half-width, so no straight edge shows.
- **Sky:** the image's sky, (7, 7, 5) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (7 of 255).

## Known problems

- The bulge's depth is modelled, not measured: the paper fits light on the sky, and the spheroid is the one that shows its axis ratio at the disc's tilt.
- The fit is of the 3.6 µm image and the picture is visible light, so the bulge's share of the picture is not exactly the fit's.
- Only the bulge has depth. The disc, its dust lane and everything else in the picture stay on the flat plane that faces the Sun, so from the side the galaxy is a round glow crossed by a line.
- The picture is flat: seen from the side it is a line.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
