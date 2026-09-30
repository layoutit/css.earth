# TOI-1898 b

## Sources

It is the only planet known around TOI-1898. Its orbit and size follow MacDougall et al. 2023's fit, the archive's default. The introduction is generated from Polanski et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.83821469 Jupiter radii from Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract): 59,925.6 km at 71,492 km per Jupiter radius. GM from the mass 0.40587939 Jupiter masses (Polanski et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJS..272...32P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Saha 2025 (2025MNRAS.539..928S), via the NASA Exoplanet Archive ps table (pl_refname SAHA_2025): P 45.522129 d Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): a/R* derived from its semi-major axis 0.269 au and stellar radius 1.6131 solar radii; Saha 2025 (2025MNRAS.539..928S), via the NASA Exoplanet Archive ps table (pl_refname SAHA_2025): inclination 87.531 degrees Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): e 0.485 Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): omega 70.99 degrees Saha 2025 (2025MNRAS.539..928S), via the NASA Exoplanet Archive ps table (pl_refname SAHA_2025): transit mid-time 2458894.25409 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1898's measured colour (#f0eeff, the colour dataset of toi-1898 (src/objects/toi-1898/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1898's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (46, 48, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1898b.json).

## Known problems

- **Orbit convention.** omega 70.99 degrees is taken as Polanski et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.485) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
