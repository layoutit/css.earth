# Southern Pinwheel (M83)

A ground-based photograph of M83, cleaned of the Milky Way stars in front of it and colour-tied to its measured
integrated colour, is spread through a modelled disc. Published catalogues of its supernova remnants, HII regions and
Wolf-Rayet sources are drawn as dots on the same disc. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [The Southern Pinwheel](https://www.eso.org/public/images/m83/) | [Record](../../sources/eso-m83.json). The Danish 1.54-metre view in B, V and R, 2373 × 2164 px over 15.60 × 14.23 arcmin (`source/source.jpg`, the Large JPEG, restored from its origin). Found in the WorldWide Telescope image index; the DECam image (noirlab2107a) cuts the disc at the top and bottom, and HAWK-I's (eso0825a) is near-infrared. |
| [Lundgren et al. (2004)](https://arxiv.org/abs/astro-ph/0404026) | [Record](../../sources/lundgren-2004-m83-molecular-kinematics.json). Table 1: position angle 45° and inclination 24°, the values their CO kinematics of the whole optical disc adopt: the disc the photograph and dots lie on. |
| [Salo et al. (2015)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/219/4) | [Record](../../sources/salo-2015-s4g-decompositions.json). S4G's 3.6 µm fit: an exponential disc with scale length 106.75″ (2.53 kpc), 87% of the light; its bulge is a small nuclear one (8%, half-light radius 9.35″ = 0.22 kpc). |
| [Kregel et al. (2002)](https://arxiv.org/abs/astro-ph/0204154) | [Record](../../sources/kregel-2002-disc-flattening.json). Sect. 4.3: discs are on average 7.3 ± 2.2 times longer than thick, so the 2.53 kpc scale length gives a 347 pc scale height. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | The 1,297 Gaia DR3 sources within 0.2° of M83's centre that Ren et al.'s criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query in the Gaia record). |
| [RC3](../../sources/rc3-1991.json) | NGC 5236's total B-V, 0.66 ± 0.03 as observed. |
| [Local Volume Database](../../sources/lvdb-v1-1-1.json) | Centre and distance: distance modulus 28.45 (Tully et al. 2009), 4.90 Mpc. |
| [Winkler et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/943/15) | [Supernova remnants](source/winkler-snr/points.json): 366 remnants and candidates over the whole galaxy. |
| [Long et al. (2022)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/929/144) | [HII regions](source/long-hii/points.json): 188 from MUSE fields over the inner disc. |
| [Hadfield et al. (2005)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/439/265) | [Wolf-Rayet sources](source/hadfield-wr/points.json): the 132 with confirmed Wolf-Rayet signatures. |
| [Bell et al. (2025)](https://arxiv.org/abs/2512.11744) | [Stellar extent](source/stellar-extent.json): the resolved red-giant halo mapped out to 40 kpc; inside it M83's caption hides. |

The catalogue tables are TAP queries of CDS (the query is each descriptor's `table.origin`); they are not tracked.

## The photograph

- **Registration:** the publisher's orientation (1.6° right of vertical) and centre do not match the image: 41 of the 150
  brightest Gaia stars agree on 0.1° and a centre 67 and 87 px away, with the scale unchanged. Bright stars then fall
  within 2 px of their images.
- **Foreground stars:** 69 of the 645 Gaia foreground stars in the image are removed where they show; 301 on the
  galaxy's light are left, and most of the rest are too faint to show.
- **Colour:** tied to RC3's B-V of 0.66: red/green 1.162 and blue/green 1.263 against 1.126 and 0.891, so red × 0.969
  and blue × 0.706 in linear light. The publisher's composite ran blue.
- **Disc:** inclination 24°, line of nodes 45°, support 9.3 kpc (where the frame stops on its tightest side), 32 slabs
  with an exponential of 347 pc over ±3 scale heights. No bulge: S4G's nuclear bulge, round on the sky (axis ratio
  0.897), cannot come from an oblate spheroid seen at 24°, and it holds 8% of the light.

## Dots

| Catalogue | Drawn | Left out |
| --- | --- | --- |
| Supernova remnants (Winkler et al. 2023) | 365 | 1 beyond the photograph |
| HII regions (Long et al. 2022) | 188 | none |
| Wolf-Rayet sources (Hadfield et al. 2005) | 132 | none |

Dots keep their place in the disc and rise along its axis to heights drawn from the 347 pc layer. Colours are the Milky
Way's and M31's for each kind; each dot takes its tone from the photograph's brightness under it (never below 15%) and
moves halfway from its kind's colour to the photograph's colour there.

## Evidence

- In the app: the default view (left) and tilted (right), with the dots.
  Captured on this branch on 2026-09-29.
- The prepared bank's `approximation.limitations` records the foreground and colour-tie counts quoted above.

## Known problems

- [Heald et al. (2016)](https://arxiv.org/abs/1607.03365) fit M83's HI disc at 48°, twice the optical disc's 24°; the outer HI disc is warped and is not
  modelled.
- The frame stops at 9.3 kpc, inside the disc's outer arms, its ultraviolet disc and its stellar halo.
- The HII regions cover the MUSE fields only.
- Depth is modelled: slabs are the photograph along our sight lines, so side views are approximate.
