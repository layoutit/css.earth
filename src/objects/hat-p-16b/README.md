# HAT-P-16 b

## Sources

It is the only planet known around HAT-P-16. Its orbit and size follow Alexoudi 2022's fit, the archive's default. The introduction is generated from Alexoudi 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 1.31 Jupiter radii from Alexoudi 2022 (2022AN....34324012A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AN....34324012A/abstract): 93,654.5 km at 71,492 km per Jupiter radius. GM from the mass 4.221 Jupiter masses (Bonomo et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017A&A...602A.107B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): P 2.77596727 d Alexoudi 2022 (2022AN....34324012A), via the NASA Exoplanet Archive ps table (pl_refname ALEXOUDI_2022): a/R* 7.73; Alexoudi 2022 (2022AN....34324012A), via the NASA Exoplanet Archive ps table (pl_refname ALEXOUDI_2022): inclination 88.4 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.036 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 214 degrees Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): transit mid-time 2456204.604299 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,855 K dayside brightness temperature measured in secondary eclipse at 4.5 µm (Deming et al. 2023, dayside brightness temperature at 4.5 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2)): #ff8200. Chosen from the archive's emission rows by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of HAT-P-16's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (17, 57, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-16b.json).


## Known problems

- **Orbit convention.** omega 214 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.036) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
