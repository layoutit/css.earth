# M102

A survey image of M102 (NGC 5866), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, stands on a flat plane facing the Sun. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 10.08 × 10.08 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 5866 = PGC 53933: centre 226.62298°, +55.76322°, D25 diameter 6.3′ (log d25 1.8), type S0-a (T = -1.3), inclination 90°, position angle 126.49°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 149 Gaia DR3 sources within 0.126° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 5866's total B-V, 0.85 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 14.96 Mpc (14.15 to 15.81). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m102-layers`). NOX leaves the wide glow of a bright star: 3 of the 3 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 230 px (46″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.85 in linear light.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line, so it faces the Sun. It has no disc to lay the picture on. This is where a sky picture lies, not a measured shape.
- **Rim:** the picture fades out on a round rim at 21.49 kpc, 0.98 of its half-width, so no straight edge shows.
- **Sky:** the image's sky, (8, 6, 5) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (8 of 255).

## Dots

| Catalogue | Drawn | Note |
| --- | --- | --- |
| [Globular cluster candidates (Cantiello et al. 2007)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/668/209), [recipe](source/cantiello-gc/points.json) | 109 | candidates picked by color, size and shape in Hubble images, not confirmed clusters |

The catalogue tables are files of the CDS archive (each descriptor's `table.origin`); they are not tracked. Each dot is a catalogued object at its published sky position, placed on the plane the picture stands on; its depth is not measured, and it is not drawn. Each dot takes its tone from the image's brightness under it and moves halfway from its kind's color to the image's color there.

## Known problems

- The picture is flat: seen from the side it is a line.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
