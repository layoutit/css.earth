# Qatar-2 b

## Sources

It is the only planet known around Qatar-2. Its orbit and size follow Mancini et al. 2014's fit, the archive's default. The introduction is generated from Mancini et al. 2014's published values; the sections below are the data's own.

**Size and mass.** Radius 1.254 Jupiter radii from Mancini et al. 2014 (2014MNRAS.443.2391M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014MNRAS.443.2391M/abstract): 89,651 km at 71,492 km per Jupiter radius. GM from the mass 2.494 Jupiter masses (Mancini et al. 2014, the mass the NASA Exoplanet Archive's composite table adopts (2014MNRAS.443.2391M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2014MNRAS.443.2391M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): P 1.33711644 d Mancini et al. 2014 (2014MNRAS.443.2391M), via the NASA Exoplanet Archive ps table (pl_refname MANCINI_ET_AL__2014): a/R* derived from its semi-major axis 0.02153 au and stellar radius 0.776 solar radii; Mancini et al. 2014 (2014MNRAS.443.2391M), via the NASA Exoplanet Archive ps table (pl_refname MANCINI_ET_AL__2014): inclination 86.12 degrees Mancini et al. 2014 (2014MNRAS.443.2391M), via the NASA Exoplanet Archive ps table (pl_refname MANCINI_ET_AL__2014): e 0 Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): transit mid-time 2457218.1101306 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by qatar-2's measured color (#ffcba8, the color dataset of qatar-2 (src/objects/qatar-2/source/photometry/stellar-color.json)) at the gray's own brightness.

**Heat map.** The page opens on a brightness-temperature map at 4.5 µm from May et al. (2022, AJ 163, 256, [arXiv:2203.15059](https://arxiv.org/abs/2203.15059)): their fit to a Spitzer IRAC 4.5 µm phase curve of 21–23 May 2017. The [record](source/science/may-2022/phase-curve.json) holds the paper's row cell by cell: the eclipse depth 3018 +/- 186 ppm, F_p/F_S at mid-eclipse ("Day"); the fitted eclipse depth row prints 3004 +/- 185 ppm, the radius ratio 0.16189 +/- 0.00015, and a first-order sinusoid, printed as its semi-amplitude, 1442 +/- 221 ppm, and the offset east of its maximum, -5.2 +/- 5.4 degrees. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 1368 +/- 32 K, implies with its eclipse depth and radius ratio (4,374 K). The false color runs from 350 to 1,450 K.

**Charts.** The orbits of Qatar-2's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-04: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/planets/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 607 K at mid-transit against the printed 724 +/- 135 K, and its maximum falls 5.2° after eclipse, as printed. [`published-phase-curve-map.test.mts`](../../../packages/bake/src/objects/raster/eclipse-map/published-phase-curve-map.test.mts) holds the printed amplitude-and-offset form to the eclipse-normalised one term for term.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/qatar-2b.json).

## Known problems

- **The map is a fit, not an image.** One Fourier series in orbital phase fixes one number per longitude; nothing is known north to south.
- **The night side is not detected.** The fit's night flux is 138 ± 400 ppm, so 61° of longitude on the night side come out with no emission and are left blank.
- **One band of two.** The same paper's 3.6 µm curve gives a day side of 1,421 ± 28 K and a night side of 842 ± 141 K; only the 4.5 µm fit is drawn.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
