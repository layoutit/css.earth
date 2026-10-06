# WASP-19 b

## Sources

It is the only planet known around Wattle. Its orbit and size follow Cortés-Zuleta et al. 2020's fit, the archive's default. The introduction is generated from Cortés-Zuleta et al. 2020's published values; the sections below are the data's own.

**Size and mass.** Radius 1.415 Jupiter radii from Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...636A..98C/abstract): 101,161.2 km at 71,492 km per Jupiter radius. GM from the mass 1.154 Jupiter masses (Cortés-Zuleta et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020A&A...636A..98C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020A&A...636A..98C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): P 0.78883900702 d Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive ps table (pl_refname CORT_EACUTE_S_ZULETA_ET_AL__2020): a/R* 3.533; Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive ps table (pl_refname CORT_EACUTE_S_ZULETA_ET_AL__2020): inclination 79.08 degrees Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive ps table (pl_refname CORT_EACUTE_S_ZULETA_ET_AL__2020): e 0.0126 Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive ps table (pl_refname CORT_EACUTE_S_ZULETA_ET_AL__2020): omega 51 degrees Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): transit mid-time 2456402.71307265 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 2,346 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Anderson et al. 2013, dayside brightness temperature at 3.6 µm (NASA Exoplanet Archive emission table)): #ff9d3d. Chosen from the archive's emission rows by rule: 8 measured of 9 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Heat map.** The page opens on a brightness-temperature map at 4.5 µm from Bell et al. (2021, MNRAS 504, 3316, [arXiv:2010.00687](https://arxiv.org/abs/2010.00687)): their fit to a Spitzer IRAC 4.5 µm phase curve (program 80073), first published by Wong et al. (2016, [arXiv:1512.09342](https://arxiv.org/abs/1512.09342)) and reanalysed with fifteen others. The [record](source/science/bell-2021/phase-curve.json) holds the paper's row cell by cell: the eclipse depth 5400 +240/-250 ppm, the radius ratio 0.1384 +/- 0.0019, and a first-order sinusoid, printed as its semi-amplitude, 2170 +220/-200 ppm, and the offset east of its maximum, -25.0 +4.7/-4.3 degrees east. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 2291 +67/-66 K, implies with its eclipse depth and radius ratio (5,169 K). The false color runs from 950 to 2,500 K.

**Charts.** The orbits of Wattle's planets from above, from their hosted-orbit records, and its transmission spectrum, 9 bins from Bean et al. 2013 in the archive's transitspec table, the most of its 2 papers; its transit in 3 TESS sectors (89, 90, 99), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-04: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/planets/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 1,279 K at mid-transit against the printed 1380 +120/-140 K, and its maximum falls 25.0° after eclipse, as printed. [`published-phase-curve-map.test.mts`](../../../packages/bake/src/objects/raster/eclipse-map/published-phase-curve-map.test.mts) holds the printed amplitude-and-offset form to the eclipse-normalised one term for term.

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-19b.json).


## Known problems

- **The map is a fit, not an image.** One Fourier series in orbital phase fixes one number per longitude; nothing is known north to south.
- **Two analyses disagree on which side is hotter.** Bell et al. (2021) find the maximum 25.0° west of noon; Wong et al. (2016), on the same data, 12.9 ± 3.6° east as Bell et al. convert it. The map follows the later, uniform reanalysis and says so.
- **Orbit convention.** omega 51 degrees is taken as Cortés-Zuleta et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0126) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-19b" (revision 1374844406) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
