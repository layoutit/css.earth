# HAT-P-38 b

## Sources

It is the only planet known around Horna. Its orbit and size follow Sato et al. 2012's fit, the archive's default. The introduction is generated from Sato et al. 2012's published values; the sections below are the data's own.

**Size and mass.** Radius 0.825 Jupiter radii from Sato et al. 2012 (2012PASJ...64...97S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2012PASJ...64...97S/abstract): 58,980.9 km at 71,492 km per Jupiter radius. GM from the mass 0.267 Jupiter masses (Sato et al. 2012, the mass the NASA Exoplanet Archive's composite table adopts (2012PASJ...64...97S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2012PASJ...64...97S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 4.64032787 d Sato et al. 2012 (2012PASJ...64...97S), via the NASA Exoplanet Archive ps table (pl_refname SATO_ET_AL__2012): a/R* 12.17; Sato et al. 2012 (2012PASJ...64...97S), via the NASA Exoplanet Archive ps table (pl_refname SATO_ET_AL__2012): inclination 88.3 degrees Sato et al. 2012 (2012PASJ...64...97S), via the NASA Exoplanet Archive ps table (pl_refname SATO_ET_AL__2012): e 0.067 Sato et al. 2012 (2012PASJ...64...97S), via the NASA Exoplanet Archive ps table (pl_refname SATO_ET_AL__2012): omega 240 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2457570.76143 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,282 K dayside brightness temperature measured in secondary eclipse at 4.5 µm (Deming et al. 2023, dayside brightness temperature at 4.5 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2)): #ff5800. Chosen from the archive's emission rows by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of Horna's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (58, 85), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-38b.json).


## Known problems

- **Orbit convention.** omega 240 degrees is taken as Sato et al. 2012 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.067) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
