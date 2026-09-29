# Nearby Universe galaxy field

Every galaxy of Cosmicflows-4 between 3 and 200 Mpc, drawn as one sharp dot at
its measured distance, in the colour of its morphological type. The dots are
thinned to an even density at every zoom, so the field never piles up around
the Milky Way and never empties as you zoom in. No brightness, glow or cloud is
drawn: nothing here is invented.

## Sources

| Source | Measurement used |
| --- | --- |
| [Cosmicflows-4, Tully et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) | Table 2: PGC number, J2000 position and the distance modulus from all methods, for 27,277 of its 55,877 galaxies, those between 3 and 200 Mpc. |
| [HyperLEDA, Makarov et al. (2014)](https://doi.org/10.1051/0004-6361/201423496) | The numerical morphological type T of 25,877 of those galaxies and the corrected total B magnitude (btc) of 26,310, joined by PGC number. |
| [Kinney et al. (1996)](https://doi.org/10.1086/177583) | The elliptical, S0, Sa, Sb and Sc template spectra from the STScI reference atlases. |
| [DESI Data Release 1 (2025)](https://arxiv.org/abs/2503.14745), clustering catalogues of [Ross et al. (2025)](https://arxiv.org/abs/2405.16593) | BGS BRIGHT-21.5 (300,043 galaxies, redshift 0.1 to 0.4, volume-limited to absolute r magnitude -21.5) with dereddened g, r and z fluxes; QSO (1,223,391 quasars, redshift 0.8 to 3.5). |
| [Francis et al. (1991)](https://doi.org/10.1086/170066) | The Large Bright Quasar Survey composite spectrum, from the STScI reference atlases. |
| [Planck 2018 VI](https://arxiv.org/abs/1807.06209) | The cosmology that turns a redshift into a distance (Astropy's Planck18) and the redshift of last scattering, z* = 1089.80. |

The [galaxy recipe](source/galaxies/points.json) records both queries and the
join. The tracked table ([cf4-hyperleda.csv.gz](source/galaxies/cf4-hyperleda.csv.gz),
439 KB) and the five templates are the inputs; the [manifest](source/manifest.json)
binds them to their source records. The [investigation ledger](investigations.json)
records what was used, replaced and left out.

## Processing

1. `packages/bake/cli/prepare-catalogue-points.mts` places each galaxy at
   10^(DM/5 + 1) pc in its J2000 direction, in the Sun-centred frame, in Mpc.
2. It colours each galaxy by its type class: the template spectrum of that class
   through the CIE 1931 observer into sRGB, the route the app uses for star
   colours. Class bounds are the midpoints between the types the templates stand
   for (E −5, S0 −2, Sa 1, Sb 3, Sc 5). The colours are E #ffdec0, S0 #ffdfc1,
   Sa #ffdcc7, Sb #ffe1cb and Sc #d9d7ff. The 1,400 galaxies HyperLEDA gives no
   type are white. Each colour is then darkened by the galaxy's absolute B
   magnitude (HyperLEDA's corrected btc minus the CF4 modulus): full at M_B
   −21.5, 30% at −17.5, about the field's 5th and 95th percentiles. The 967
   galaxies without btc take the darkest tone. Only the colour changes; no dot
   is transparent.
3. `packages/bake/cli/merge-catalogue-points.mts` thins the galaxies into four nested levels. The field holds 0.18
   galaxies per 1,000 Mpc³ out to 200 Mpc, half what CF4 still holds at its
   edge. Around the Milky Way, levels out to 60, 20 and 10 Mpc bring that up to
   5, 25 and 90, each under what CF4 holds there. Each level only adds galaxies
   the levels around it do not draw, and its density falls to nothing over its
   outer half.
4. `packages/bake/cli/stack-catalogue-points.mts` joins the levels into [one bank](source/dots/stack.json) of
   7,077 dots. The app draws a growing share of it as you zoom in: the whole
   field within 100 Mpc, then each level's galaxies one at a time as the view
   narrows past the level's radius, so a level's edge is never on screen and a
   dot you have seen stays while you zoom in.

## Beyond the Cosmicflows-4 field

Past 200 Mpc the view is DESI's first data release, drawn as the same dots, in
two shells on DESI's footprint (about a third of the sky, north and south of the
Milky Way's plane). At the edge is the cosmic microwave background, which the
[Observable Universe](../observable-universe/README.md) package draws; that
overview reads from 1 Gpc out.

- **Bright galaxies** ([recipe](source/desi-bright-galaxies/points.json)): one
  in 10 of BGS BRIGHT-21.5 (30,005 galaxies, 670 to 1,575 Mpc for the 5th to
  95th percentile), each at its comoving distance in the Planck 2018 cosmology.
  Each galaxy's colour is its g, r and z fluxes drawn as the Legacy Surveys
  viewer draws them (legacypipe `sdss_rgb`: z red times 2.2, r green times 3.4,
  g blue times 6.0), the brightest channel full: the colour its light arrives
  with, so galaxies at redshift 0.3 look orange. Each tone is its r magnitude
  at its luminosity distance, without k-correction: full at -23.4, 40% at
  -22.5. The sample is volume-limited, so it is drawn as a plain random share
  with no density cap, keeping the web's real contrast; they are drawn whole
  within 1,600 Mpc of the Milky Way.
- **Quasars** ([recipe](source/desi-quasars/points.json)): one in 150 of the
  QSO catalogue (8,157 quasars, 3.3 to 6.4 Gpc), each in the colour of the
  Francis et al. composite stretched to its redshift (in steps of 0.1): the
  colour its light arrives with. At redshift 0.8 and beyond the visible range
  is 211 to 433 nm in the quasar's frame, inside the composite's range. They are
  drawn whole within 6,600 Mpc.
## Tests and evidence

On the experimental cosmic-web branch, another [capture](evidence/2026-09-29/capture.json)
shows, 7.6 billion light-years out
(captured at 40 Gpc plus three notches, before the opening distance moved),
[DESI's two cones](evidence/2026-09-29/desi-cones.jpg) of bright galaxies either
side of the Milky Way's plane, with the Cosmicflows-4 field between them. It was
taken before overviews had their own pages; the view opens now at
`/observable-universe/`.

A [browser capture](evidence/2026-09-29/capture.json) of this version shows
[the whole field](evidence/2026-09-29/field.jpg) from 200 Mpc: sharp dots in
their type colours and brightness tones, even across the view.

The renderer's catalogue point tests parse the prepared bank and check that a
stacked bank only adds dots as the view narrows
(`packages/renderer/src/universe/catalogue-points.test.ts`). The
[context lineage test](../../../tests/contract/context-lineage.test.mts)
checks that its products read only its source records.

## Known problems

- DESI covers only its footprint, so the far view is two cones, not a sphere.
  Projected through 1.5 Gpc of depth, the cosmic web's filaments are faint;
  surveys show them in thin slices.
- The bright galaxies' tones have no k-correction, and their colours are
  observed-frame, redder than the galaxies' own light.

- The field is not a complete survey. CF4 is flux-limited, so the even density
  is set by what it holds at its edge, and real concentrations above it are
  thinned. The zone the Milky Way's disc hides is empty in the catalogue, not
  in space.
- Beyond about 150 Mpc only the SDSS fundamental-plane sample reaches, over
  part of the northern sky; the field stops at 200 Mpc.
- The templates are spectra of galaxy centres (Kinney et al. 1996 used the IUE
  aperture), not whole-galaxy light, so every colour but Sc is a close warm
  white. Types later than Sc take the Sc template, the latest in the atlas.
- Distance uncertainties (CF4's e_DM) are not drawn.
- Nearer than 3 Mpc, the [Local Group catalogue](../local-group/README.md) draws
  each galaxy as a marker instead.
