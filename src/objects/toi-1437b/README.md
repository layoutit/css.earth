# TOI-1437 b

## Sources

It is the only planet known around TOI-1437. Its orbit and size follow Pidhorodetska et al. 2024's fit, the archive's default. This account was drafted from Pidhorodetska et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.19983976 Jupiter radii from Pidhorodetska et al. 2024 (2024AJ....168..135P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168..135P/abstract): 14,286.9 km at 71,492 km per Jupiter radius. GM from the mass 0.03020498 Jupiter masses (Pidhorodetska et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024AJ....168..135P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024AJ....168..135P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 18.840891 d Pidhorodetska et al. 2024 (2024AJ....168..135P), via the NASA Exoplanet Archive ps table (pl_refname PIDHORODETSKA_ET_AL_2024): a/R* 25.7; Pidhorodetska et al. 2024 (2024AJ....168..135P), via the NASA Exoplanet Archive ps table (pl_refname PIDHORODETSKA_ET_AL_2024): inclination 89.53 degrees Pidhorodetska et al. 2024 (2024AJ....168..135P), via the NASA Exoplanet Archive ps table (pl_refname PIDHORODETSKA_ET_AL_2024): e 0.17 Pidhorodetska et al. 2024 (2024AJ....168..135P), via the NASA Exoplanet Archive ps table (pl_refname PIDHORODETSKA_ET_AL_2024): omega -96.3 degrees, stored as 263.7 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460660.183368 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1437's measured colour (#fdf6ff, the colour dataset of toi-1437 (src/objects/toi-1437/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1437's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (83, 84, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1437b.json).


## Known problems

- **Orbit convention.** omega -96.3 degrees is taken as Pidhorodetska et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.17) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
