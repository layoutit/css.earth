# TOI-512 b

## Sources

It is the only planet known around TOI-512. Its orbit and size follow Rodrigues et al. 2025's fit, the archive's default. The introduction is generated from Rodrigues et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.13738983 Jupiter radii from Rodrigues et al. 2025 (2025A&A...695A.237R), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...695A.237R/abstract): 9,822.3 km at 71,492 km per Jupiter radius. GM from the mass 0.01123248 Jupiter masses (Rodrigues et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...695A.237R), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...695A.237R/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 7.18873321304 d Rodrigues et al. 2025 (2025A&A...695A.237R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUES_ET_AL_2025): a/R* derived by Kepler's third law from its period 7.18873321304 d, stellar mass 0.74 and radius 0.89 solar units; Rodrigues et al. 2025 (2025A&A...695A.237R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUES_ET_AL_2025): inclination 88.92 degrees Rodrigues et al. 2025 (2025A&A...695A.237R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUES_ET_AL_2025): e 0.02 Rodrigues et al. 2025 (2025A&A...695A.237R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUES_ET_AL_2025): omega -54 degrees, stored as 306 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458471.218204 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 23 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-512's measured colour (#ffebdf, the colour dataset of toi-512 (src/objects/toi-512/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-512's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (33, 87, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-512b.json).

## Known problems

- **Orbit convention.** omega -54 degrees is taken as Rodrigues et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.02) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
