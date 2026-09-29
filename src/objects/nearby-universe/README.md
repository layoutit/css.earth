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
| [HyperLEDA, Makarov et al. (2014)](https://doi.org/10.1051/0004-6361/201423496) | The numerical morphological type T of 25,877 of those galaxies, joined by PGC number. |
| [Kinney et al. (1996)](https://doi.org/10.1086/177583) | The elliptical, S0, Sa, Sb and Sc template spectra from the STScI reference atlases. |

The [galaxy recipe](source/galaxies/points.json) records both queries and the
join. The tracked table ([cf4-hyperleda.csv.gz](source/galaxies/cf4-hyperleda.csv.gz),
369 KB) and the five templates are the inputs; the [manifest](source/manifest.json)
binds them to their source records. The [investigation ledger](investigations.json)
records what was used, replaced and left out.

## Processing

1. `tools/objects/catalogue-points/prepare.mts` places each galaxy at
   10^(DM/5 + 1) pc in its J2000 direction, in the Sun-centred frame, in Mpc.
2. It colours each galaxy by its type class: the template spectrum of that class
   through the CIE 1931 observer into sRGB, the route the app uses for star
   colours. Class bounds are the midpoints between the types the templates stand
   for (E −5, S0 −2, Sa 1, Sb 3, Sc 5). The colours are E #ffdec0, S0 #ffdfc1,
   Sa #ffdcc7, Sb #ffe1cb and Sc #d9d7ff. The 1,400 galaxies HyperLEDA gives no
   type are white.
3. `merge.mts` thins the galaxies into four nested levels. The field holds 0.18
   galaxies per 1,000 Mpc³ out to 200 Mpc, half what CF4 still holds at its
   edge. Around the Milky Way, levels out to 60, 20 and 10 Mpc bring that up to
   5, 25 and 90, each under what CF4 holds there. Each level only adds galaxies
   the levels around it do not draw, and its density falls to nothing over its
   outer half.
4. `stack.mts` joins the levels into [one bank](source/dots/stack.json) of
   7,077 dots. The app draws a growing share of it as you zoom in: the whole
   field within 100 Mpc, then each level's galaxies one at a time as the view
   narrows past the level's radius, so a level's edge is never on screen and a
   dot you have seen stays while you zoom in.

## Tests and evidence

The renderer's catalogue point tests parse the prepared bank and check that a
stacked bank only adds dots as the view narrows
(`packages/renderer/src/universe/catalogue-points.test.ts`). The
[context provenance tests](../../../tests/contract/context-provenance.test.mts)
verify output and inventory pins.

## Known problems

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
