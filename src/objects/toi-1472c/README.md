# TOI-1472 c

## Sources

It is one of 2 planets known around TOI-1472. Its orbit and size follow Carleo et al. 2026's fit, the archive's default. The introduction is generated from Carleo et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.298 Jupiter radii from Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549f1958C/abstract): 21,304.6 km at 71,492 km per Jupiter radius. GM from the mass 0.067 Jupiter masses (Carleo et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026MNRAS.549f1958C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026MNRAS.549f1958C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): P 15.5381747 d Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): a/R* 33.665; Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): inclination 88.906 degrees Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): e 0.172 Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): omega 164.7 degrees Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): transit mid-time 2459689.93567 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-1472's measured color (#ffe1cc, the color dataset of toi-1472 (src/objects/toi-1472/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1472's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (58, 84, 85), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1472c.json).

## Known problems

- **Orbit convention.** omega 164.7 degrees is taken as Carleo et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.172) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
