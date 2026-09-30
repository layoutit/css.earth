# Nearby Universe galaxy field

Every galaxy of Cosmicflows-4 between 3 and 200 Mpc, and every Local Volume Database galaxy nearer than that, drawn as one sharp dot at its measured distance, in the colour of its morphological type. Nothing is thinned, so clusters and filaments keep the contrast the catalogues measured. No brightness, glow or cloud is drawn.

## Sources

| Source | Measurement used |
| --- | --- |
| [Cosmicflows-4, Tully et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) | Table 2: PGC number, J2000 position and the distance modulus from all methods, for 27,277 of its 55,877 galaxies, those between 3 and 200 Mpc. |
| [HyperLEDA, Makarov et al. (2014)](https://doi.org/10.1051/0004-6361/201423496) | The numerical morphological type T of 25,877 of those galaxies and the corrected total B magnitude (btc) of 26,310, joined by PGC number. |
| [Local Volume Database v1.1.1, Pace (2025)](https://doi.org/10.33232/001c.144859) | Through the [Local Group catalogue](../local-group/README.md): the 200 galaxies nearer than Cosmicflows-4's nearest (3.03 Mpc), with their adopted distances and apparent V magnitudes. |
| [Kinney et al. (1996)](https://doi.org/10.1086/177583) | The elliptical, S0, Sa, Sb and Sc template spectra from the STScI reference atlases. |
| [DESI Data Release 1 (2025)](https://arxiv.org/abs/2503.14745), clustering catalogues of [Ross et al. (2025)](https://arxiv.org/abs/2405.16593) | BGS BRIGHT-21.5 (300,043 galaxies, redshift 0.1 to 0.4, volume-limited to absolute r magnitude -21.5) with dereddened g, r and z fluxes; QSO (1,223,391 quasars, redshift 0.8 to 3.5). |
| [Quaia, Storey-Fisher et al. (2024)](https://doi.org/10.3847/1538-4357/ad1328) | The G < 20.0 catalogue from CDS/VizieR (J/ApJ/964/69): Gaia DR3 source id, ICRS position and redshift of its 619,961 quasars between redshift 0.8 and 3.5. |
| [Francis et al. (1991)](https://doi.org/10.1086/170066) | The Large Bright Quasar Survey composite spectrum, from the STScI reference atlases. |
| [Planck 2018 VI](https://arxiv.org/abs/1807.06209) | The cosmology that turns a redshift into a distance (Astropy's Planck18) and the redshift of last scattering, z* = 1089.80. |

The [galaxy recipe](source/galaxies/points.json) records both queries and the join. The tracked table ([cf4-hyperleda.csv.gz](source/galaxies/cf4-hyperleda.csv.gz)) and the five templates are the inputs; the [manifest](source/manifest.json) binds them to their source records. The [investigation ledger](investigations.json) records what was used, replaced and left out.

## Processing

1. `packages/bake/cli/prepare-catalogue-points.mts` places each galaxy at 10^(DM/5 + 1) pc in its J2000 direction, in the Sun-centred frame, in Mpc.
2. It colours each galaxy by its type class: the template spectrum of that class through the CIE 1931 observer into sRGB, the route the app uses for star colours. The colours are E #ffdec0, S0 #ffdfc1, Sa #ffdcc7, Sb #ffe1cb and Sc #d9d7ff. The 1,400 galaxies HyperLEDA gives no type are white. Each colour is then darkened by the galaxy's absolute B magnitude: full at M_B −21.5, 30% at −17.5. The 967 galaxies without btc take the darkest tone.
3. [`local-group-sample.mts`](../../../packages/bake/authoring/nearby-universe/local-group-sample.mts) takes the Local Group catalogue's galaxies nearer than the field's nearest galaxy, leaving out those drawn as their own objects (M31, M33, the Magellanic Clouds). The same route places them and tones them by absolute V magnitude, LVDB having no B; nearly all are dwarfs and take the faintest tone. LVDB gives no type, so they are white.
4. `packages/bake/cli/merge-catalogue-points.mts` joins both into one level and `stack-catalogue-points.mts` into [one bank](source/dots/stack.json) of 27,477 dots, drawn whole within 100 Mpc. At most 25,000 are drawn at once: past that the app keeps a fixed share, so zooming never swaps one dot for another. The quasar and bright-galaxy banks have the same budget.

## Beyond the Cosmicflows-4 field

Past 200 Mpc the view is DESI's first data release, drawn as the same dots, in two shells on DESI's footprint (about a quarter of the sky, north and south of the Milky Way's plane). Quaia's quasars fill the rest of the quasar shell. At the edge is the cosmic microwave background, which the [Observable Universe](../observable-universe/README.md) package draws.

- **Bright galaxies** ([recipe](source/desi-bright-galaxies/points.json)): one in 10 of BGS BRIGHT-21.5 (30,005 galaxies, 670 to 1,575 Mpc for the 5th to 95th percentile), each at its comoving distance in the Planck 2018 cosmology. Each colour is its g, r and z fluxes drawn as the Legacy Surveys viewer draws them (legacypipe `sdss_rgb`), the colour its light arrives with, so galaxies at redshift 0.3 look orange. The sample is volume-limited, so it is drawn as a plain random share with no density cap.
- **Quasars** ([DESI recipe](source/desi-quasars/points.json), [Quaia recipe](source/quaia-quasars/points.json), [merge](source/quasars/merge.json)): one shell of 35,212 dots, 2.8 to 6.6 Gpc away, each in the colour of the Francis et al. composite stretched to its redshift.
  - On DESI's footprint, one in 100 of DESI's QSO catalogue (12,235).
  - Everywhere else, Quaia at the same density on the sky (22,977).
  - [`quaia-sample.mts`](../../../packages/bake/authoring/nearby-universe/quaia-sample.mts) finds DESI's footprint from the tracked DESI sample:
    - It cuts the sky into 7,200 equal-area cells of 5.73 deg².
    - A cell belongs to DESI when it holds at least half DESI's median count per cell. That covers 9,884 deg².
    - It keeps the 413,578 Quaia quasars outside those cells, one in 9 in source id order: the ratio of the two samples' median counts per cell (99 to 11).
  - A bank draws at most 40,000 dots, so the merge keeps one in 2 of each sample, and both stay at one density.

## Evidence

![The quasar shell from the Observable Universe page, and the field from 100 Mpc](evidence/2026-09-30/filled-shell-and-field.jpg)

Browser captures of this version: the Observable Universe page's default view, where the quasars close into one shell, and the whole field from 100 Mpc, where the Virgo Cluster is a dense patch under its marker. The earlier thinned field drew 4 of Virgo's 175 catalogued galaxies there. The renderer's catalogue point tests (`packages/renderer/src/universe/catalogue-points.test.ts`) check that a stacked bank only adds dots as the view narrows. The [context lineage test](../../../site/test/context-lineage.test.mts) checks that its products read only its source records.

## Known problems

- DESI's galaxies cover only its footprint, so the bright galaxies are two cones, not a sphere. Projected through 1.5 Gpc of depth, the cosmic web's filaments are faint.
- Neither survey sees through the Milky Way's disc, so a band of the quasar shell along it is nearly empty.
- Quaia's redshifts come from Gaia's low-resolution spectra, less precise than DESI's, so its quasars sit less sharply in depth. Its G < 20.0 limit also keeps fewer faint, distant quasars than DESI. The footprint cells are 2.4° across, so the join between the two samples is uneven on that scale.
- The bright galaxies' tones have no k-correction, and their colours are observed-frame, redder than the galaxies' own light.
- The field is not a complete survey. CF4 is flux-limited, so it is denser near the Milky Way and thins toward 200 Mpc. The zone the Milky Way's disc hides is empty in the catalogue, not in space.
- Beyond about 150 Mpc only the SDSS fundamental-plane sample reaches, over part of the northern sky.
- The templates are spectra of galaxy centres, not whole-galaxy light, so every colour but Sc is a close warm white. Types later than Sc take the Sc template.
- Distance uncertainties (CF4's e_DM) are not drawn.
- The Local Group dots put V magnitudes on the field's B tone scale. Galaxies are brighter in V than in B, so a galaxy near the bright end can take a lighter tone than its B magnitude would give.
