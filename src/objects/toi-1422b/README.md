# TOI-1422 b

## Sources

It is one of 2 planets known around TOI-1422. Its orbit and size follow Naponiello et al. 2026's fit, the archive's default. The introduction is generated from Naponiello et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.3416903 Jupiter radii from Naponiello et al. 2026 (2026MNRAS.545f2030N), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.545f2030N/abstract): 24,428.1 km at 71,492 km per Jupiter radius. GM from the mass 0.02989034 Jupiter masses (Naponiello et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026MNRAS.545f2030N), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026MNRAS.545f2030N/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Naponiello et al. 2026 (2026MNRAS.545f2030N), via the NASA Exoplanet Archive ps table (pl_refname NAPONIELLO_ET_AL_2026): P 12.99894 d Naponiello et al. 2026 (2026MNRAS.545f2030N), via the NASA Exoplanet Archive ps table (pl_refname NAPONIELLO_ET_AL_2026): a/R* 22.51; Naponiello et al. 2026 (2026MNRAS.545f2030N), via the NASA Exoplanet Archive ps table (pl_refname NAPONIELLO_ET_AL_2026): inclination 89.53 degrees Naponiello et al. 2026 (2026MNRAS.545f2030N), via the NASA Exoplanet Archive ps table (pl_refname NAPONIELLO_ET_AL_2026): e 0.2 Naponiello et al. 2026 (2026MNRAS.545f2030N), via the NASA Exoplanet Archive ps table (pl_refname NAPONIELLO_ET_AL_2026): omega 90 degrees Naponiello et al. 2026 (2026MNRAS.545f2030N), via the NASA Exoplanet Archive ps table (pl_refname NAPONIELLO_ET_AL_2026): transit mid-time 2458745.9405 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 8 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1422's measured colour (#fff4f4, the colour dataset of toi-1422 (src/objects/toi-1422/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1422's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (17, 57, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1422b.json).

## Known problems

- **Orbit convention.** omega 90 degrees is taken as Naponiello et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.2) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
