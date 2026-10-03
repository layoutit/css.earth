# M108

A survey image of M108 (NGC 3556), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, stands on a flat plane facing the Sun. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 6.36 × 6.36 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 3556 = PGC 34030: centre 167.87890°, +55.67427°, D25 diameter 4.0′ (log d25 1.6), type Sc (T = 5.9), inclination 67.53°, position angle 79°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 46 Gaia DR3 sources within 0.0795° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 3556's total B-V, 0.66 ± 0.02 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 9.18 Mpc (7.64 to 11.04). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m108-layers`). NOX leaves the wide glow of a bright star: 2 of the 2 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 94 px (12″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.66 in linear light.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line, so it faces the Sun. Its disc is tilted 68° (HyperLEDA), too steep to lay the picture on: a flat picture of a disc seen that close to edge-on would stretch its bulge across the plane. This is where a sky picture lies, not a measured shape.
- **Rim:** the picture fades out on a round rim at 8.325 kpc, 0.98 of its half-width, so no straight edge shows.
- **Sky:** the image's sky, (9, 9, 7) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (9 of 255).

## Known problems

- The picture is flat: seen from the side it is a line.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
