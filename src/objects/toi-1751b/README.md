# TOI-1751 b

## Sources

It is the only planet known around TOI-1751. Its orbit and size follow MacDougall et al. 2023's fit, the archive's default. The introduction is generated from Polanski et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.26325181 Jupiter radii from Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract): 18,820.4 km at 71,492 km per Jupiter radius. GM from the mass 0.06135386 Jupiter masses (Polanski et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJS..272...32P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 37.4685042 d Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): a/R* derived from its semi-major axis 0.215 au and stellar radius 1.3137 solar radii; Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): inclination derived from its impact parameter 0.389551 with its a/R* 35.1921 and the orbit's e 0.327, omega 120 degrees (Winn 2010, eq. 7) Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): e 0.327 Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): omega 120 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460607.061003 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 6 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1751's measured colour (#fbf6ff, the colour dataset of toi-1751 (src/objects/toi-1751/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1751's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (84, 85, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1751b.json).

## Known problems

- **Orbit convention.** omega 120 degrees is taken as Polanski et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.327) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
