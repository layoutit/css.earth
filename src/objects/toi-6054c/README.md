# TOI-6054 c

## Sources

It is one of 2 planets known around TOI-6054. Its orbit and size follow Kroft et al. 2025's fit, the archive's default. The introduction is generated from Kroft et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.25158398 Jupiter radii from Kroft et al. 2025 (2025AJ....170..150K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..150K/abstract): 17,986.2 km at 71,492 km per Jupiter radius. GM from the mass 0.02926107 Jupiter masses (Kroft et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025AJ....170..150K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025AJ....170..150K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kroft et al. 2025 (2025AJ....170..150K), via the NASA Exoplanet Archive ps table (pl_refname KROFT_ET_AL__2025): P 12.563636 d Kroft et al. 2025 (2025AJ....170..150K), via the NASA Exoplanet Archive ps table (pl_refname KROFT_ET_AL__2025): a/R* 13.99; Kroft et al. 2025 (2025AJ....170..150K), via the NASA Exoplanet Archive ps table (pl_refname KROFT_ET_AL__2025): inclination 88.82 degrees Kroft et al. 2025 (2025AJ....170..150K), via the NASA Exoplanet Archive ps table (pl_refname KROFT_ET_AL__2025): e 0.332 Kroft et al. 2025 (2025AJ....170..150K), via the NASA Exoplanet Archive ps table (pl_refname KROFT_ET_AL__2025): omega -163 degrees, stored as 197 Kroft et al. 2025 (2025AJ....170..150K), via the NASA Exoplanet Archive ps table (pl_refname KROFT_ET_AL__2025): transit mid-time 2458826.8929 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 26 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-6054's measured color (#fbf6ff, the color dataset of toi-6054 (src/objects/toi-6054/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-6054's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (59, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-6054c.json).

## Known problems

- **Orbit convention.** omega -163 degrees is taken as Kroft et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.332) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
