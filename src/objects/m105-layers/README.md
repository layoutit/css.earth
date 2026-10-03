# M105

A survey image of M105 (NGC 3379), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, stands on a flat plane facing the Sun. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 7.80 × 7.80 arcmin, tangent projection, north up (`source/source.jpg`, restored from its origin). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 3379 = PGC 32256: centre 161.95665°, +12.58164°, D25 diameter 4.9′ (log d25 1.689), type E (T = -4.8), inclination 40.14°, position angle 71°. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 63 Gaia DR3 sources within 0.0975° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). |
| [RC3](../../sources/rc3-1991.json) | NGC 3379's total B-V, 0.96 ± 0.01 as observed. |
| Tully et al. (2023) | [Record](../../sources/cosmicflows-4.json). Distance: 11.05 Mpc (10.95 to 11.15). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Foreground stars:** the bake removes the Gaia foreground stars where they show and leaves those on extended light.
- **Color:** tied to RC3's B-V of 0.96 in linear light.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line, so it faces the Sun. It has no disc to lay the picture on. This is where a sky picture lies, not a measured shape.
- **Rim:** the picture fades out on a round rim at 12.29 kpc, 0.98 of its half-width, so no straight edge shows.
- **Sky:** the image's sky, (17, 14, 9) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (17 of 255).

## Known problems

- The picture is flat: seen from the side it is a line.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- Fainter and uncatalogued foreground stars remain.
