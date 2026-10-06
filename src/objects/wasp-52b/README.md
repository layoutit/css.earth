# WASP-52 b

## Sources

It is the only planet known around Anadolu. Its orbit and size follow Hebrard et al. 2013's fit, the archive's default. The introduction is generated from Hebrard et al. 2013's published values; the sections below are the data's own.

**Size and mass.** Radius 1.27 Jupiter radii from Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A%26A...549A.134H/abstract): 90,794.8 km at 71,492 km per Jupiter radius. GM from the mass 0.46 Jupiter masses (Hebrard et al. 2013, the mass the NASA Exoplanet Archive's composite table adopts (2013A&A...549A.134H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2013A%26A...549A.134H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2022 (2022ApJS..258...40K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2022): P 1.74978119 d Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive ps table (pl_refname HEBRARD_ET_AL__2013): a/R* 7.3801; Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive ps table (pl_refname HEBRARD_ET_AL__2013): inclination 85.35 degrees Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive ps table (pl_refname HEBRARD_ET_AL__2013): e 0 Kokori et al. 2022 (2022ApJS..258...40K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2022): transit mid-time 2456770.05972 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by wasp-52's measured color (#ffe6d0, the color dataset of wasp-52 (src/objects/wasp-52/source/photometry/stellar-color.json)) at the gray's own brightness.

**Heat map.** The page opens on a brightness-temperature map at 3.6 µm from May et al. (2022, AJ 163, 256, [arXiv:2203.15059](https://arxiv.org/abs/2203.15059)): their fit to two Spitzer IRAC 3.6 µm phase curves, of 17–19 October 2016 and 21–23 October 2017, fitted together. The [record](source/science/may-2022/phase-curve.json) holds the paper's row cell by cell: the eclipse depth 2206 +/- 77 ppm, F_p/F_S at mid-eclipse ("Day"); the fitted eclipse depth row prints 2201 +/- 77 ppm, the radius ratio 0.16464 +/- 0.00011, and a first-order sinusoid, printed as its semi-amplitude, 650 +/- 79 ppm, and the offset east of its maximum, -2.1 +/- 4.9 degrees. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 1454 +/- 21 K, implies with its eclipse depth and radius ratio (5,098 K). The false color runs from 1,000 to 1,500 K.

**Charts.** The orbits of Anadolu's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (83), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-04: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/planets/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 1,110 K at mid-transit against the printed 1116 +/- 46 K, and its maximum falls 2.1° after eclipse, as printed. [`published-phase-curve-map.test.mts`](../../../packages/bake/src/objects/raster/eclipse-map/published-phase-curve-map.test.mts) holds the printed amplitude-and-offset form to the eclipse-normalised one term for term.

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-52b.json).


## Known problems

- **The map is a fit, not an image.** One Fourier series in orbital phase fixes one number per longitude; nothing is known north to south.
- **The other band disagrees, and its authors doubt it.** The paper's 4.5 µm curve puts the maximum 31.8 ± 7.8° east with a night side of 1,224 ± 77 K, and it cautions that this data set "is potentially unreliable". The 3.6 µm fit is the one drawn.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
