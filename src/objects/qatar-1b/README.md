# Qatar-1 b

## Sources

It is the only planet known around Qatar-1. Its orbit and size follow Collins et al. 2017's fit, the archive's default. The introduction is generated from Collins et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 1.143 Jupiter radii from Collins et al. 2017 (2017AJ....153...78C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153...78C/abstract): 81,715.4 km at 71,492 km per Jupiter radius. GM from the mass 1.294 Jupiter masses (Collins et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153...78C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153...78C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): P 1.420024291 d Collins et al. 2017 (2017AJ....153...78C), via the NASA Exoplanet Archive ps table (pl_refname COLLINS_ET_AL__2017): a/R* 6.247; Collins et al. 2017 (2017AJ....153...78C), via the NASA Exoplanet Archive ps table (pl_refname COLLINS_ET_AL__2017): inclination 84.08 degrees Collins et al. 2017 (2017AJ....153...78C), via the NASA Exoplanet Archive ps table (pl_refname COLLINS_ET_AL__2017): e 0 Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): transit mid-time 2457570.346134 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by qatar-1's measured color (#ffd7bb, the color dataset of qatar-1 (src/objects/qatar-1/source/photometry/stellar-color.json)) at the gray's own brightness.

**Heat map.** The page opens on a brightness-temperature map at 4.5 µm from May et al. (2022, AJ 163, 256, [arXiv:2203.15059](https://arxiv.org/abs/2203.15059)): their fit to a Spitzer IRAC 4.5 µm phase curve of 2–3 May 2018. The [record](source/science/may-2022/phase-curve.json) holds the paper's row cell by cell: the eclipse depth 2922 +/- 163 ppm, F_p/F_S at mid-eclipse ("Day"); the fitted eclipse depth row prints 2914 +/- 162 ppm, the radius ratio 0.14514 +/- 0.00018, and a first-order sinusoid, printed as its semi-amplitude, 769 +/- 213 ppm, and the offset east of its maximum, -7.98 +/- 5.79 degrees. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 1696 +/- 39 K, implies with its eclipse depth and radius ratio (5,572 K). The false color runs from 1,150 to 1,800 K.

**Charts.** The orbits of Qatar-1's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (84, 85, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-04: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 1,259 K at mid-transit against the printed 1098 +/- 158 K, and its maximum falls 8.0° after eclipse, as printed. [`published-phase-curve-map.test.mts`](../../../packages/bake/src/objects/raster/eclipse-map/published-phase-curve-map.test.mts) holds the printed amplitude-and-offset form to the eclipse-normalised one term for term.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/qatar-1b.json).

## Known problems

- **The map is a fit, not an image.** One Fourier series in orbital phase fixes one number per longitude; nothing is known north to south.
- **The paper's night side is cooler than its own fluxes give.** Its table prints a night side of 1,098 ± 158 K for a night flux of 1,399 ppm; under the one conversion its day side implies, that flux is 1,259 K, 1.0σ away. The map follows the fluxes.
- **Three analyses of this curve.** Keating et al. (2020, [arXiv:2004.00014](https://arxiv.org/abs/2004.00014)) found the maximum 4.0 ± 7.0° west and a night side of 1,167 ± 71 K; Bell et al. (2021, [arXiv:2010.00687](https://arxiv.org/abs/2010.00687)) preferred a second-order curve peaking 33° west with a night side of 900 ± 180 K. May et al. is the latest and prints a first-order fit in full.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
