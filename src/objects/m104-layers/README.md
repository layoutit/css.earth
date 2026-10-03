# Sombrero Galaxy

A survey image of the Sombrero Galaxy (NGC 4594), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, stands on a flat plane facing the Sun, with its bulge standing through it as a volume. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 13.50 × 13.50 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4594 = PGC 42407: centre 189.99770°, -11.62301°, D25 diameter 8.5′ (log d25 1.927), type Sa (T = 1.1), inclination 59.44°, position angle 89.3°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 338 Gaia DR3 sources within 0.1688° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 4594's total B-V, 0.98 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 9.38 Mpc (9.08 to 9.70). |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit of NGC4594 (table 7, model `_bz`): a Sérsic bulge (82.6% of the light, magnitude 7.317, half-light radius 180.42″ = 8.21 kpc, n = 4.663, axis ratio 0.608, PA 88.81°) and an edge-on disc (17.4% of the light, scale length 49.25″ = 2.24 kpc, scale height 10.80″ = 0.49 kpc, PA 89.25°, central surface brightness 17.946 as seen). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m104-layers`). NOX leaves the wide glow of a bright star: 6 of the 6 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 230 px (62″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.98 in linear light.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line, so it faces the Sun. HyperLEDA's 59° comes from the outline of its bulge; its dust lane shows a disc seen almost edge-on, so no disc is drawn. This is where a sky picture lies, not a measured shape.
- **Bulge:** the bulge takes the fit's own light, scaled to the photograph and never more than the photograph holds there, in an oblate spheroid through the picture. The spheroid is flattened along the normal of the galaxy's own disc (S4G fits this galaxy's disc with its edge-on disc function (component Z, edgedisk), the profile of a disc seen at 90°, at this position angle), with intrinsic axis ratio 0.61, the one that projects to 0.608 at 90°, and the fit's deprojected Sérsic density. The flat picture keeps the rest, so the view from the Sun is unchanged. The spheroid ends where the picture ends (18.06 kpc, 2.2 half-light radii), fading over the picture's own taper from 12.64 kpc: a presentation choice.
- **Rim:** the picture fades out on a round rim at 18.06 kpc, 0.98 of its half-width, so no straight edge shows.
- **Sky:** the image's sky, (18, 17, 11) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (18 of 255).

## Dots

| Catalogue | Drawn | Note |
| --- | --- | --- |
| [Globular clusters (Spitler et al. 2006)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/132/1593), [recipe](source/spitler-gc/points.json) | 659 | from a Hubble mosaic of the galaxy |
| [Planetary nebulae (Ford et al. 1996)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/458/455), [recipe](source/ford-pne/points.json) | 289 | the survey for the galaxy's distance; 5 more lie outside the photograph |

The catalogue tables are files of the CDS archive (each descriptor's `table.origin`); they are not tracked. Each dot is a catalogued object at its published sky position, placed on the plane the picture stands on; its depth is not measured, and it is not drawn. Each dot takes its tone from the image's brightness under it and moves halfway from its kind's color to the image's color there.

## Known problems

- The bulge's depth is modelled, not measured: the paper fits light on the sky, and the spheroid is the one that shows its axis ratio at the disc's tilt.
- The fit is of the 3.6 µm image and the picture is visible light, so the bulge's share of the picture is not exactly the fit's.
- Only the bulge has depth. The disc, its dust lane and everything else in the picture stay on the flat plane that faces the Sun, so from the side the galaxy is a round glow crossed by a line.
- The picture is flat: seen from the side it is a line.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
