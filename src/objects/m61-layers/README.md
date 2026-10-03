# M61

A survey image of M61 (NGC 4303), cleaned of the Milky Way stars in front of it and color-tied to its measured integrated color, lies flat on its measured disc. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 3000 × 3000 px over 11.04 × 11.04 arcmin, tangent projection, north up (`source/starless.jpg`: the download with its stars removed, restored from the source cache). A display composite, not calibrated photometry. |
| [HyperLEDA](http://atlas.obs-hp.fr/hyperleda/) (Makarov et al. 2014) | [Record](../../sources/hyperleda-2014.json). NGC 4303 = PGC 40001: centre 185.47841°, +4.47378°, D25 diameter 6.9′ (log d25 1.838), type Sbc (T = 4). |
| [Leroy et al. (2021), PHANGS-ALMA](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/257/43) | [Record](../../sources/leroy-2021-phangs-alma.json). Row NGC4303: inclination 23.5 ± 9.2°, position angle 312.4 ± 2.5°, from the rotation of its gas ([Lang et al. 2020](../../sources/lang-2020-phangs-kinematics.json)). |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 156 Gaia DR3 sources within 0.138° of the centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the manifest). Its stars brighter than G 14 are where remove-stars looks for a glow. |
| [RC3](../../sources/rc3-1991.json) | NGC 4303's total B-V, 0.53 ± 0.01 as observed. |
| Leroy et al. (2021) | [Record](../../sources/leroy-2021-phangs-alma.json). Distance: 16.99 Mpc (13.97 to 20.01). |

## The image

- **Registration:** the cutout's registration is its request: a tangent projection centred on the galaxy, north up.
- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m61-layers`). NOX leaves the wide glow of a bright star: 2 of the 2 Gaia stars brighter than G 14 in the picture had a glow, filled out to at most 78 px (17″), each measured on the picture and filled from the ring around it. The bake's own pass over the Gaia foreground stars then removes any that still show.
- **Color:** tied to RC3's B-V of 0.53 in linear light.
- **Disc:** inclination 23.5°, line of nodes 312.4°, drawn as one flat image on the midplane. The support radius, 20.42 kpc, is 1.2 times the D25 radius (3.4′), a presentation choice that keeps the faint light outside that isophote.
- **Near side:** the source gives the tilt, not which edge is nearer. The disc is drawn with the edge at position angle 42° nearer: an assumption, not a measurement.
- **Sky:** the image's sky, (6, 6, 4) of 255 (each channel's median over the frame's outer ring), is subtracted as the background floor (6 of 255).

## Dots

| Catalogue | Drawn | Note |
| --- | --- | --- |
| [Planetary nebulae (Scheuermann et al. 2022)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/511/6087), [recipe](source/scheuermann-pne/points.json) | 19 | type PN |
| [Supernova remnants (Scheuermann et al. 2022)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/511/6087), [recipe](source/scheuermann-snr/points.json) | 8 | type SNR |

The catalogue tables are files of the CDS archive (each descriptor's `table.origin`); they are not tracked. Each dot is a catalogued object at its published sky position, placed where its sight line meets the disc. Its height above the disc is drawn from a 422 pc layer, the scale length over 7.3 ([Kregel et al. 2002](https://arxiv.org/abs/astro-ph/0204154), [record](../../sources/kregel-2002-disc-flattening.json)); that height is not measured. Each dot takes its tone from the image's brightness under it and moves halfway from its kind's color to the image's color there.

Ionised nebulae (Groves et al. 2023) are not drawn yet: CDS's TAP service, the only route to that table short of a 43 MB file, did not answer on 2026-10-03.

## Known problems

- Which edge of the disc is nearer is assumed.
- The survey image is shallow: faint outer light is lost, and the brightest part of the centre may be saturated.
- NOX predicts the light under each star; it does not measure it. It also takes the galaxy's own compact light, its clusters and star-forming knots, so the arms are smoother than in the survey picture. Where a bright star's glow was filled, a faint patch can show.
