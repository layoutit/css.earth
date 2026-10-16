# HAT-P-30 b

## Sources

It is the only planet known around HAT-P-30. Its orbit and size follow Stassun et al. 2017's fit, the archive's default. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 1.44 Jupiter radii from Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract): 102,948.5 km at 71,492 km per Jupiter radius. GM from the mass 0.83 Jupiter masses (Stassun et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153..136S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): P 2.8106007 d Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): a/R* 7.43; Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): inclination 83.6 degrees Knutson et al. 2014 (2014ApJ...785..126K), via the NASA Exoplanet Archive ps table (pl_refname KNUTSON_ET_AL__2014): e 0.02 Knutson et al. 2014 (2014ApJ...785..126K), via the NASA Exoplanet Archive ps table (pl_refname KNUTSON_ET_AL__2014): omega 114 degrees Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): transit mid-time 2457775.212778 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,960 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Deming et al. 2023, dayside brightness temperature at 3.6 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2)): #ff880f. Chosen from the archive's emission rows by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of HAT-P-30's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (34, 61, 88), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-30b.json).


## Known problems

- **Orbit convention.** omega 114 degrees is taken as Knutson et al. 2014 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.02) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
