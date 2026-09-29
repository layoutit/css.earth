# NGC 300

A ground-based photograph of NGC 300, cleaned of the Milky Way stars in front of it and colour-tied to its measured
integrated colour, is spread through a modelled disc. Published catalogues of its planetary nebulae, HII regions,
Cepheids, OB associations and supernova remnants are drawn as dots on the same disc. Image brightness does not measure
per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Spiral galaxy NGC 300](https://www.eso.org/public/images/eso1037a/) | [Record](../../sources/eso-eso1037a.json). The MPG/ESO 2.2-metre WFI view in B, [O III], V, R and H-alpha, 7603 × 7603 px over 30.22 × 30.22 arcmin (`source/source.jpg`, the Large JPEG, restored from its origin). Found in the WorldWide Telescope image index. |
| [Westmeier et al. (2011)](https://arxiv.org/abs/1009.0317) | [Record](../../sources/westmeier-2011-ngc300-hi.json). Table 1: the inner HI disc at position angle 290°; Sect. 4: a geometric inclination of about 44°, consistent with their tilted rings (40° to 50°): the disc the photograph and dots lie on. |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit: a single exponential disc with scale length 152.16″ (1.54 kpc), no bulge. |
| [Kregel et al. (2002)](https://arxiv.org/abs/astro-ph/0204154) | [Record](../../sources/kregel-2002-disc-flattening.json). Sect. 4.3: discs are on average 7.3 ± 2.2 times longer than thick, so the 1.54 kpc scale length gives a 211 pc scale height. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 1,027 Gaia DR3 sources within 0.38° of NGC 300's centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the Gaia record). |
| [RC3](../../sources/rc3-1991.json) | NGC 300's total B-V, 0.59 ± 0.03 as observed. |
| [Local Volume Database](../../sources/lvdb-v1-1-1.json) | Centre and distance: distance modulus 26.6 (Tully et al. 2009), 2.09 Mpc. |
| [Peña et al. (2012)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/547/A78) | [Planetary nebulae](source/pena-pne/points.json): 101 of their 112, leaving out the rows they mark as compact HII regions, very uncertain or indefinite. |
| [Soffner et al. (1996)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/306/9) | [HII regions](source/soffner-hii/points.json): 90 in their three fields. |
| [Pietrzyński et al. (2002)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/123/789) | [Cepheids](source/pietrzynski-cepheids/points.json): 117 with periods. |
| [Pietrzyński et al. (2001)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/371/497) | [OB associations](source/pietrzynski-ob/points.json): 117 candidates. |
| [Vučetić et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/446/943) | [Supernova remnants](source/vucetic-snr/points.json): 22 optically identified remnants. |
| [Bland-Hawthorn et al. (2005)](https://arxiv.org/abs/astro-ph/0503488) | [Stellar extent](source/stellar-extent.json): star counts trace the disc to 24′, about 14.4 kpc at their 2.0 Mpc, with no truncation; inside it NGC 300's caption hides. |

The catalogue tables are TAP queries of CDS (the query is each descriptor's `table.origin`); they are not tracked.

## The photograph

- **Registration:** the publisher's stated centre is 28 px from the image's: bright Gaia stars all sat 28 px to one side.
  With the centre moved, they fall within a few pixels of their images; the stated orientation fits.
- **Foreground stars:** 145 of the 567 Gaia foreground stars in the image are removed where they show; 125 on the
  galaxy's light are left, and most of the rest are too faint to show at the 3000 px face size.
- **Colour:** tied to RC3's B-V of 0.59: red/green 1.099 and blue/green 1.183 against 1.085 and 0.919, so red × 0.987
  and blue × 0.777 in linear light. The publisher's composite ran blue.
- **Disc:** inclination 44°, line of nodes 110°, support 9.4 kpc (where the frame stops on its tightest side), 32 slabs
  with an exponential of 211 pc over ±3 scale heights. No bulge: S4G fits NGC 300 with a disc alone.

## Dots

| Catalogue | Drawn | Left out |
| --- | --- | --- |
| Planetary nebulae (Peña et al. 2012) | 101 | 11 rows the authors flag |
| HII regions (Soffner et al. 1996) | 90 | none |
| Cepheids (Pietrzyński et al. 2002) | 115 | 2 beyond the photograph |
| OB associations (Pietrzyński et al. 2001) | 117 | none |
| Supernova remnants (Vučetić et al. 2015) | 22 | none |

Dots keep their place in the disc and rise along its axis to heights drawn from the 211 pc layer. Colours are the Milky
Way's and M31's for each kind; each dot takes its tone from the photograph's brightness under it (never below 15%) and
moves halfway from its kind's colour to the photograph's colour there.

## Evidence

- [In the app](evidence/2026-09-29/dots-from-photograph.jpg): the default view (left) and tilted (right), with the dots.
  Captured on this branch on 2026-09-29.
- The prepared bank's `approximation.limitations` records the foreground and colour-tie counts quoted above.

## Known problems

- Westmeier et al.'s HI disc twists by about 40° beyond 10 arcmin; only the inner disc's orientation is used.
- The frame stops at 9.4 kpc, inside the 14.4 kpc to which the stars are traced.
- Soffner et al.'s HII regions cover three fields only.
- Depth is modelled: slabs are the photograph along our sight lines, so side views are approximate.
