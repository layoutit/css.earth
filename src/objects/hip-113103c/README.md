# HIP 113103 c

## Sources

It is one of 2 planets known around HIP 113103. Its orbit and size follow Lowson et al. 2024's fit, the archive's default. The introduction is generated from Lowson et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.21411403 Jupiter radii from Lowson et al. 2024 (2024MNRAS.527.1146L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.527.1146L/abstract): 15,307.4 km at 71,492 km per Jupiter radius. GM from the mass 0.02 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 14.2456603 d Lowson et al. 2024 (2024MNRAS.527.1146L), via the NASA Exoplanet Archive ps table (pl_refname LOWSON_ET_AL_2024): a/R* 32.49; Lowson et al. 2024 (2024MNRAS.527.1146L), via the NASA Exoplanet Archive ps table (pl_refname LOWSON_ET_AL_2024): inclination 89.24 degrees Lowson et al. 2024 (2024MNRAS.527.1146L), via the NASA Exoplanet Archive ps table (pl_refname LOWSON_ET_AL_2024): e 0.17 Lowson et al. 2024 (2024MNRAS.527.1146L), via the NASA Exoplanet Archive ps table (pl_refname LOWSON_ET_AL_2024): omega -70 degrees, stored as 290 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460160.495921 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by hip-113103's measured color (#ffd9c0, the color dataset of hip-113103 (src/objects/hip-113103/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HIP 113103's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (95, 96, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hip-113103c.json).

## Known problems

- **Orbit convention.** omega -70 degrees is taken as Lowson et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.17) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
