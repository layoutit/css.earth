# WASP-77 A b

## Sources

It is the only planet known around WASP-77 A. Its orbit and size follow Cortés-Zuleta et al. 2020's fit, the archive's default. The introduction is generated from Noguer et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 1.23 Jupiter radii from Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...636A..98C/abstract): 87,935.2 km at 71,492 km per Jupiter radius. GM from the mass 1.6654 Jupiter masses (Noguer et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024PASP..136f4401N), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024PASP..136f4401N/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): P 1.360029395 d Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): a/R* 5.490086; Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): inclination 89.99 degrees Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): e 0.01353 Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): omega -88.29 degrees, stored as 271.71 Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): transit mid-time 2459957.33786 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,815 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Deming et al. 2023, dayside brightness temperature at 3.6 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2)): #ff8000. Chosen from the archive's emission rows by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Heat map.** The page opens on a brightness-temperature map at 4.5 µm from Davenport et al. (2025, AJ 169, 260, [arXiv:2503.12521](https://arxiv.org/abs/2503.12521)): their fit to a Spitzer IRAC 4.5 µm phase curve of 29 November to 1 December 2016 (program 13038). The [record](source/science/davenport-2025/phase-curve.json) holds the paper's fit-results table cell by cell, in the values corrected for the light of the companion star WASP-77 B: the planet's flux at mid-eclipse 2944 ± 76 ppm, the radius ratio 0.1130 ± 0.00071, and a symmetric sinusoid, printed as its amplitude, 919 ± 40 ppm, and its phase offset, 16.28 ± 2.52° east. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 1780 ± 25 K, implies with that flux and radius ratio (4,154 K). The false color runs from 1,100 to 1,900 K.

**Charts.** The orbits of WASP-77 A's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (4, 31), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-08: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/planets/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 1,227 K at mid-transit against the printed 1234 ± 20 K, and its maximum falls 16.3° before eclipse, as printed.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-77-a-b.json).

## Known problems

- **The map is a fit, not an image.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.
- **The paper's text and its table disagree.** For this channel the body text gives a day side of 1334 ± 15 K and a night side of 987 ± 15 K; the fit-results table and the abstract give 1780 ± 25 K and 1234 ± 20 K. The record reads the table.
- **The star's implied temperature is low.** The printed day side, flux and radius ratio together imply 4,154 K for the star at 4.5 µm, low for WASP-77 A. The map's temperatures are anchored on the printed day side, and its night side lands on the paper's.
- **No 3.6 µm map.** The paper's best fit at 3.6 µm adds a half-period term and prints one amplitude and one offset for it, which do not determine that curve.
- **Orbit convention.** omega -88.29 degrees is taken as Noguer et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.01353) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
