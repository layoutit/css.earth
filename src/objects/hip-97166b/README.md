# HIP 97166 b

## Sources

It is one of 2 planets known around HIP 97166. Its orbit and size follow MacDougall et al. 2023's fit, the archive's default. The introduction is generated from Polanski et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.2212631 Jupiter radii from Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract): 15,818.5 km at 71,492 km per Jupiter radius. GM from the mass 0.06009532 Jupiter masses (Polanski et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJS..272...32P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 10.288886 d Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): a/R* derived from its semi-major axis 0.091 au and stellar radius 0.8418 solar radii; Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): inclination derived from its impact parameter 0.327997 with its a/R* 23.2453 and the orbit's e 0.29, omega 98 degrees (Winn 2010, eq. 7) Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): e 0.29 Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): omega 98 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460646.544681 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hip-97166's measured colour (#ffe5d3, the colour dataset of hip-97166 (src/objects/hip-97166/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HIP 97166's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (84, 85, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hip-97166b.json).

## Known problems

- **Orbit convention.** omega 98 degrees is taken as Polanski et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.29) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
