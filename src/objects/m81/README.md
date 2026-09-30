# Bode's Galaxy (M81)

A ground-based photograph of M81, cleaned of the Milky Way stars in front of it and colour-tied to its measured integrated
colour, is spread through a modelled disc and a round bulge. Published catalogues of its planetary nebulae, globular
clusters and supernova remnants are drawn as dots on the same disc. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Galaxies M81 & M82](https://noirlab.edu/public/images/noao-m81m82/) | [Record](../../sources/noirlab-noao-m81m82.json). T.A. Rector's Mayall 4-meter view of M81 and M82, 8315 × 4642 px over 58.87 × 32.87 arcmin (`source/source.jpg`, the Large JPEG, restored from its origin). Found with `telescope explore m81`. M82 lies 51 kpc out in M81's disc plane, beyond the photograph's support, so it fades out. |
| [de Blok et al. (2008)](https://arxiv.org/abs/0810.2100) | [Record](../../sources/de-blok-2008-things-rotation-curves.json). THINGS Table 2: M81's H I disc at inclination 59.0° and position angle 330.2°: the disc the photograph and dots lie on. |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm bulge-plus-disc fit: a Sérsic bulge (half-light radius 102.96″ = 1.80 kpc, n = 3.557, axis ratio 0.654, PA 145.0°, 46% of the light) and an exponential disc (scale length 153.17″ = 2.68 kpc, axis ratio 0.543, PA 156.3°). |
| [Kregel et al. (2002)](https://arxiv.org/abs/astro-ph/0204154) | [Record](../../sources/kregel-2002-disc-flattening.json). Sect. 4.3: discs are on average 7.3 ± 2.2 times longer than thick, so M81's 2.68 kpc scale length gives a 368 pc scale height. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 3,207 Gaia DR3 sources within 0.58° of the photograph's centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the Gaia record). |
| [RC3](../../sources/rc3-1991.json) | NGC 3031's total B-V, 0.95 ± 0.01 as observed (0.82 corrected). |
| [Local Volume Database](../../sources/lvdb-v1-1-1.json) | Centre and distance: distance modulus 27.79 (Newman et al. 2024), 3.61 Mpc. |
| [Jacoby et al. (1989)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/344/704) | [Planetary nebulae](source/jacoby-pne/points.json): 185 from [O III] imaging (B1950; VizieR's ICRS conversion). |
| [Nantais & Huchra (2010)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/139/2620) | [Globular clusters](source/nantais-gc/points.json): 108 confirmed by spectroscopy. |
| [Vučetić et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/446/943) | [Supernova remnants](source/vucetic-snr/points.json): 41 optically identified remnants. |
| [Smercina et al. (2020)](https://arxiv.org/abs/1910.14672) | [Stellar extent](source/stellar-extent.json): red-giant halo stars detected out to 65 kpc along the minor axis; inside it M81's caption hides. |

The catalogue tables are TAP queries of CDS (the query is each descriptor's `table.origin`); they are not tracked.

## The photograph

- **Registration:** the publisher's stated centre does not match the Large JPEG: M81's and M82's cores sit 769 px and
  339 px from where it puts them, with rotation and scale right to 0.09° and 0.03%. The recipe's centre is re-measured
  from the two cores; bright Gaia stars then land on their images.
- **Foreground stars:** 1,343 of the 1,585 Gaia foreground stars in the image are removed where they show; 61 on
  extended light are left.
- **Colour:** tied to RC3's B-V of 0.95: red/green 0.960 and blue/green 0.853 against 1.328 and 0.776, so red × 1.383
  and blue × 0.909 in linear light. The publisher's composite had run green.
- **Bulge:** S4G's fit splits the light; its bulge becomes an oblate spheroid with intrinsic axis ratio 0.47 (the one that
  projects to 0.654 at 59°), so seen from above it stays round. The fit's bulge falls off more slowly than its disc and
  would keep a third of the light at 9 kpc, the arms' light, so its share fades to nothing between 3 and 6 kpc
  (`extentKpc.fadeFrom`), a presentation choice. Where the photograph is saturated (21,105 pixels) the fit's light
  stands in.
- **Disc:** inclination 59.0°, line of nodes 150.2°, support 16.5 kpc (where the frame stops on its tightest side), 32
  slabs with an exponential of 368 pc over ±3 scale heights.

## Dots

| Catalogue | Drawn | Left out |
| --- | --- | --- |
| Planetary nebulae (Jacoby et al. 1989) | 185, 127 of them in the bulge | none |
| Globular clusters (Nantais & Huchra 2010) | 100, 33 of them in the bulge | 8 beyond the photograph |
| Supernova remnants (Vučetić et al. 2015) | 41 | none |

Dots keep their place in the disc and rise along its axis to heights drawn from the 368 pc layer; old objects near the
centre are bulge members with the bulge's share of the light. Colours are the Milky Way's and M31's for each kind; each dot takes its tone from the photograph's brightness under it (never below 15%) and moves halfway from its kind's colour to the photograph's colour there, so dots sit in the galaxy's light instead of on it; flat tints read as dark specks on the bright bulge. Globular clusters belong to the halo, so on the disc their places are
approximate.

## Evidence

- Dots from the photograph: the default view (left) and tilted (right), in the app with each dot's tone and colour taken from the photograph. Captured on this branch on 2026-09-29.
- The prepared bank's `approximation.limitations` records the foreground, colour-tie and saturation counts quoted above.
- Bytes: 150 layer images, 1.47 MB.
- Tests: `tests/image-layers/bulge.test.mts` pins the bulge model and its fade (`extentKpc.fadeFrom`), on M81's fit.

## Known problems

- One flat disc and one bulge fit; the ongoing interaction with M82 and NGC 3077 is not modelled.
- The dot catalogues trace old objects; no catalogue of M81's HII regions with positions is on CDS, so its young
  population shows only in the photograph.
- Depth is modelled: slabs and bulge are the photograph along our sight lines, so side views are approximate.
