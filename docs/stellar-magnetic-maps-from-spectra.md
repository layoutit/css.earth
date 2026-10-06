# A star's magnetic map from archived spectra

A magnetic field splits a star's spectral lines and polarises their light. As the star turns, each patch of field crosses
the visible disc with its own Doppler shift, so a series of polarised spectra through one rotation holds a picture of the
field over the surface. Recovering that picture is called Zeeman-Doppler imaging. Most stars with such spectra in a public
archive have no published map file, and many have no published map at all.

This note describes how the telescope's ESPaDOnS archive tools turn the archived spectra of one observing run into a map,
whose code does each step, what the result was checked against, and what it cannot do.

A map made this way is **this project's reduction**. It is not a published map, and every dataset made from one says so.

## Whose code does what

The method is not ours, and neither is the code that carries it out. Each step is run by the code its authors publish and
maintain, pinned in [`toolchain.json`](../packages/telescope-cli/src/archives/espadons/toolchain.json):

| Step | Code | What it does |
| --- | --- | --- |
| Line depths | [Korg](https://github.com/ajwheeler/Korg.jl) (Wheeler et al. 2023, AJ 165, 68; 2024, AJ 167, 83) | The central depth of each atomic line in a MARCS model atmosphere of the star's temperature, gravity and metallicity |
| Mean line | [LSDpy](https://github.com/folsomcp/LSDpy), after Donati et al. (1997, MNRAS 291, 658) | Averages thousands of lines of one spectrum into one intensity, one polarisation and one null profile |
| Longitudinal field | [SpecpolFlow](https://github.com/folsomcp/specpolFlow) | The field along the line of sight, averaged over the disc, from each mean profile; it also supplies the regions of the Earth's bands and of the hydrogen lines that a line list leaves out |
| The map | [ZDIpy](https://github.com/folsomcp/ZDIpy) (Folsom et al. 2018, MNRAS 474, 4956), after Donati et al. (2006, MNRAS 370, 629) | The field over the surface, as spherical harmonics of a radial, a poloidal and a toroidal part, that reproduces the run's polarised profiles with the least field |

What this repository writes is what lies between them: the reader of the archive's files, the reader of Kurucz's atomic line
list (positions, strengths and each line's sensitivity to a field), the files each code reads, and the conversion of ZDIpy's
map to the table the star packages already draw. The GPL codes are run as tools; none of their source is in the repository.

## What goes in

| Input | Where it comes from |
| --- | --- |
| The spectra | CFHT's ESPaDOnS spectropolarimeter, as reduced by the observatory and served by the Canadian Astronomy Data Centre; a program pins each file by its size |
| The atomic lines | R. L. Kurucz's list `gfall08oct17.dat`, pinned by its size |
| Temperature, gravity, metallicity | A catalogue, with the row cited: the TESS Input Catalog where it has both, else the dwarf sequence of Pecaut & Mamajek (2013) by the star's spectral type |
| Radial velocity | SIMBAD, with the paper it cites; the star's line is looked for within 30 km/s of it |
| Rotation period, tilt of the axis, projected rotation speed, how much slower the poles turn | Papers. A map cannot find these by itself |
| The finest detail to fit (the highest harmonic degree) | The paper that mapped the star, or the star's rotation speed |

## The one open choice

ZDIpy fits a map to a target: how closely its profiles must match the observed ones. A tighter target always fits better and
always needs more field, and past some point the extra field only fits noise. The codes leave the target to the person
running them.

[`reduce.mts`](../packages/telescope-cli/src/archives/espadons/reduce.mts) fits a ladder of targets from loose to tight and
keeps every step in the run's receipt. Between two steps it works out what the tighter fit cost: the percent of chi-square
lost for each percent of mean field added. That price is low at first, best in the middle, and collapses when the field
starts to fit noise. The map is the last step before the price, past its best, falls under `KNEE`. The value of `KNEE` is
set on published maps, as the next section describes.

Alvarado-Gómez et al. (2015, A&A 582, A38, section 6.2) publish a rule of the same kind, on the information content of the
finished maps instead of the field strength. It needs a choice of its own (how finely a map's values are binned), which is
why it is not used here.

## What it was checked against

[`benchmark.mts`](../packages/telescope-cli/src/archives/espadons/benchmark.mts) reduces nothing: it reads the receipts of
every program whose `published` block holds what a paper prints for the same run, and scores a rule for the target against
them. [`compare.mts`](../packages/telescope-cli/src/archives/espadons/compare.mts) sets one program's longitudinal fields
beside a paper's table, spectrum by spectrum.

38 runs of 23 stars with published maps are pinned, from F to late M stars. Each is reduced with the rotation, tilt and
harmonic degree its paper used:

- **21 runs give a map.** The median of our mean field over the published one is 1.05, and the runs scatter about it by a
  factor 1.4. The share of the energy in the toroidal part differs from the published share by 11 points rms (20 runs),
  3 points lower on average. With `KNEE` at 0.3 the median is 1.06 and at 0.7 it is 0.97.
- **14 runs give no map to show**, each with its reason in the receipt: in 5 the field is not detected, and in 9 the fit
  does not describe the spectra (the next section says which stars).
- **3 runs are not reduced**: one star is cooler than the model atmospheres reach, and one run's line is too shallow for
  ZDIpy to start from.

| Run | Spectra | Mean field here | Published | Toroidal here | Published |
| --- | --- | --- | --- | --- | --- |
| HD 189733, June 2007 (K2) | 15 | 24 G | 22 G | 59% | 57% |
| HD 189733, September 2013 | 7 | 50 G | 42 G | 45% | 59% |
| EK Dra, November 2006 (G1.5) | 9 | 93 G | 90 G | 80% | 83% |
| HIP 12545, September 2012 (K6) | 16 | 133 G | 116 G | 29% | 43% |
| HIP 76768, May 2013 (K5) | 24 | 162 G | 113 G | 66% | 63% |
| BD-16 351, September 2012 (K) | 16 | 69 G | 49 G | 57% | 38% |
| TYC 5164-567-1, June 2013 (K1) | 19 | 74 G | 64 G | 8% | 11% |
| EQ Peg A, August 2006 (M3.5) | 15 | 509 G | 480 G | 13% | 15% |
| EQ Peg B, August 2006 (M4) | 14 | 442 G | 450 G | 10% | 3% |
| V374 Peg, August 2006 (M3.5) | 22 | 578 G | 700 G | 2% | 4% |
| GJ 1156, January 2008 (M4.5) | 6 | 105 G | 100 G | 23% | 17% |
| GJ 1245 B, September 2007 (M6) | 6 | 122 G | 180 G | 5% | 16% |

On single spectra: the 15 longitudinal fields of HD 189733 in June 2007 have a mean of -3.36 G against the -3.47 G of Fares
et al. (2010, Table 1), with an rms difference of 0.82 G, a third of the two error bars combined.

Two things keep a result honest without a paper to check it against, and both are measured on these runs:

- **The field must be detected.** With N points in a run's polarised profiles, their reduced chi-square with no field is
  1 ± sqrt(2 / N) when there is nothing to see. A run under 4 standard deviations gets no map. DX Cnc's three runs, at 1.6 to
  3.4, gave mean fields 2 to 11 times the published ones before this rule.
- **The map must describe the spectra.** A map whose reduced chi-square stays above 2, or whose ladder has fewer than three
  steps, is kept in its receipt and marked not to show.

## What it cannot do

- **Red dwarfs with kilogauss fields.** ZDIpy treats the field as weak: the polarisation of a line is taken to follow the
  slope of the line. Above about a kilogauss that fails, and the fit stops far from the noise: GJ 51 (published 1.6 kG),
  WX UMa (1 kG), EV Lac (570 G) and AD Leo stop at a reduced chi-square of 2.3 to 19.5, with mean fields 0.06 to 3.6 times
  the published ones. On GJ 51 the longitudinal fields are 0.43 to 0.61 of the published ones (Morin et al. 2010), with the
  same variation from night to night (correlation 0.85). These runs are the ones marked not to show.
- **A field that changes during the run.** A map is one field. HD 189733's nights of June and August 2006, which its paper
  maps together, stop at a reduced chi-square of 8.9 here; August alone reaches 1.25.
- **Stars cooler than 2,800 K.** Korg's grid of model atmospheres stops there, so no line list is made (GJ 3622).
- **What the papers used that the archive lacks.** A published map may use spectra of another telescope (four of HD 189733's
  twenty spectra of June 2007 are from NARVAL), another line list, and another person's choice of target.
- **Brightness.** ZDIpy can also map dark and bright spots from the unpolarised profiles of fast rotators. That is not built.

## Running it

```sh
node packages/telescope-cli/src/archives/espadons/toolchain.mts install          # once: about 3.3 GB under output/toolchains/zdi
node packages/telescope-cli/src/archives/espadons/archive.mts --runs --ra 300.182 --dec 22.711
node packages/telescope-cli/src/archives/espadons/archive.mts hd-189733-2007-06 --name "HD 189733" --ra 300.182 --dec 22.711 --from 2007-06-20 --to 2007-07-06
# add the program's atmosphere, radialVelocity and star blocks, each value with its source
node packages/telescope-cli/src/archives/espadons/reduce.mts hd-189733-2007-06
node packages/telescope-cli/src/archives/espadons/compare.mts hd-189733-2007-06  # when the program has a published block
pnpm telescope new-object --from-spectra hd-189733 --out output/maps/hd-189733.json
pnpm telescope new-object output/maps/hd-189733.json --bake
```

The last two commands put each reduced map on the star's page as a "Radial field" dataset. A star with such datasets can
then be given a corona ([A star's corona from its magnetic map](stellar-corona-from-magnetic-maps.md)).

## On the star's page

- **One tilt.** A map sits on the sphere the way it was fitted. A page that draws the star's axis by convention alone is
  given the tilt and the period its maps are fitted with, cited as the program cites them. A page that already draws a
  measured tilt keeps it, and only maps fitted with that tilt (within 5°) are drafted: HD 189733's page draws 71.87°, so its
  runs are reduced again with that tilt instead of the papers' 85°.
- **One scale.** All of a star's maps share one color scale, so stepping through them shows the field change. A star with
  one map has no steps.
- **Only maps to show.** A run whose receipt says the field is not detected, or that the map does not describe the
  spectra, is not drafted; the draft names it with the reason.
- **The bake.** A map is a new surface image, so the star is baked through its page text. Its arrival picture is retaken
  only when its axis changed.

[What the archive holds](espadons-ledger.md) lists every shipped star with spectra and how far each has come.
