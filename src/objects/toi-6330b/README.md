# TOI-6330 b

## Sources

It is the only planet known around TOI-6330. Its orbit and size follow Hotnisky et al. 2025's fit, the archive's default. The introduction is generated from Hotnisky et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.972 Jupiter radii from Hotnisky et al. 2025 (2025AJ....170....1H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170....1H/abstract): 69,490.2 km at 71,492 km per Jupiter radius. GM from the mass 10 Jupiter masses (Hotnisky et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025AJ....170....1H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025AJ....170....1H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hotnisky et al. 2025 (2025AJ....170....1H), via the NASA Exoplanet Archive ps table (pl_refname HOTNISKY_ET_AL__2025): P 6.8500246 d Hotnisky et al. 2025 (2025AJ....170....1H), via the NASA Exoplanet Archive ps table (pl_refname HOTNISKY_ET_AL__2025): a/R* 25.55; Hotnisky et al. 2025 (2025AJ....170....1H), via the NASA Exoplanet Archive ps table (pl_refname HOTNISKY_ET_AL__2025): inclination 88.41 degrees Hotnisky et al. 2025 (2025AJ....170....1H), via the NASA Exoplanet Archive ps table (pl_refname HOTNISKY_ET_AL__2025): e 0.34 Hotnisky et al. 2025 (2025AJ....170....1H), via the NASA Exoplanet Archive ps table (pl_refname HOTNISKY_ET_AL__2025): omega 37 degrees Hotnisky et al. 2025 (2025AJ....170....1H), via the NASA Exoplanet Archive ps table (pl_refname HOTNISKY_ET_AL__2025): transit mid-time 2459901.36114 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-6330's measured colour (#ffc689, the colour dataset of toi-6330 (src/objects/toi-6330/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-6330's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (85), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-6330b.json).

## Known problems

- **Orbit convention.** omega 37 degrees is taken as Hotnisky et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.34) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
