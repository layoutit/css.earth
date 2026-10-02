# LHS 1678 c

## Sources

It is one of 3 planets known around LHS 1678. Its orbit and size follow Silverstein et al. 2022's fit, the archive's default. The introduction is generated from Silverstein et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.08395054 Jupiter radii from Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..255S/abstract): 6,001.8 km at 71,492 km per Jupiter radius. No mass is measured: Silverstein et al. 2022 (2022AJ....163..151S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..151S/abstract) gives only an upper limit of 0.00440489 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): P 3.694284 d Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): a/R* 21.36; Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): inclination 88.82 degrees Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): e 0.039 Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): omega 23 degrees Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): transit mid-time 2458998.45607 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by lhs-1678's measured color (#ffc282, the color dataset of lhs-1678 (src/objects/lhs-1678/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of LHS 1678's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (31, 32, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/lhs-1678c.json).

## Known problems

- **Orbit convention.** omega 23 degrees is taken as Silverstein et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.039) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
