# HAT-P-22 b

## Sources

It is the only planet known around HAT-P-22. Its orbit and size follow Stassun et al. 2017's fit, the archive's default. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 1.15 Jupiter radii from Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract): 82,215.8 km at 71,492 km per Jupiter radius. GM from the mass 2.47 Jupiter masses (Stassun et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153..136S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 3.2122302 d Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): a/R* 8.58; Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): inclination 86.9 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.016 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 156 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460362.105227 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,434 K dayside brightness temperature measured in secondary eclipse at 4.5 µm (Deming et al. 2023, dayside brightness temperature at 4.5 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2)): #ff6700. Chosen from the archive's emission rows by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of HAT-P-22's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (21, 48, 75), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-22b.json).

## Known problems

- **Orbit convention.** omega 156 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.016) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
