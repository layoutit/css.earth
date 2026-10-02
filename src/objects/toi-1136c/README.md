# TOI-1136 c

## Sources

It is one of 6 planets known around TOI-1136. Its orbit and size follow Dai et al. 2023's fit, the archive's default. The introduction is generated from Beard et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.24707713 Jupiter radii from Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract): 17,664 km at 71,492 km per Jupiter radius. GM from the mass 0.01988494 Jupiter masses (Beard et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024AJ....167...70B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024AJ....167...70B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 6.2586065 d Beard et al. 2024 (2024AJ....167...70B), via the NASA Exoplanet Archive ps table (pl_refname BEARD_ET_AL__2024): a/R* derived from its semi-major axis 0.0669 au and stellar radius 0.968 solar radii; Beard et al. 2024 (2024AJ....167...70B), via the NASA Exoplanet Archive ps table (pl_refname BEARD_ET_AL__2024): inclination 88.8 degrees Beard et al. 2024 (2024AJ....167...70B), via the NASA Exoplanet Archive ps table (pl_refname BEARD_ET_AL__2024): e 0.11 Beard et al. 2024 (2024AJ....167...70B), via the NASA Exoplanet Archive ps table (pl_refname BEARD_ET_AL__2024): omega 70 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460366.026514 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-1136's measured color (#fff3f3, the color dataset of toi-1136 (src/objects/toi-1136/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1136's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (41, 48, 75), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1136c.json).

## Known problems

- **Orbit convention.** omega 70 degrees is taken as Beard et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.11) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
