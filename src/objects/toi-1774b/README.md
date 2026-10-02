# TOI-1774 b

## Sources

It is one of 2 planets known around TOI-1774. Its orbit and size follow Lienhard et al. 2026's fit, the archive's default. The introduction is generated from Lienhard et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.24801541 Jupiter radii from Lienhard et al. 2026 (2026MNRAS.545f1934L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.545f1934L/abstract): 17,731.1 km at 71,492 km per Jupiter radius. GM from the mass 0.02674399 Jupiter masses (Lienhard et al. 2026, the minimum mass (M sin i) the NASA Exoplanet Archive's composite table adopts (2026MNRAS.545f1934L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026MNRAS.545f1934L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Lienhard et al. 2026 (2026MNRAS.545f1934L), via the NASA Exoplanet Archive ps table (pl_refname LIENHARD_ET_AL_2026): P 16.70988 d Lienhard et al. 2026 (2026MNRAS.545f1934L), via the NASA Exoplanet Archive ps table (pl_refname LIENHARD_ET_AL_2026): a/R* 24.3; Lienhard et al. 2026 (2026MNRAS.545f1934L), via the NASA Exoplanet Archive ps table (pl_refname LIENHARD_ET_AL_2026): inclination 89.4 degrees Lienhard et al. 2026 (2026MNRAS.545f1934L), via the NASA Exoplanet Archive ps table (pl_refname LIENHARD_ET_AL_2026): e 0.05 Lienhard et al. 2026 (2026MNRAS.545f1934L), via the NASA Exoplanet Archive ps table (pl_refname LIENHARD_ET_AL_2026): omega 282 degrees Lienhard et al. 2026 (2026MNRAS.545f1934L), via the NASA Exoplanet Archive ps table (pl_refname LIENHARD_ET_AL_2026): transit mid-time 2459674.4131 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-1774's measured color (#fff4f3, the color dataset of toi-1774 (src/objects/toi-1774/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1774's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (21, 48), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1774b.json).

## Known problems

- **Orbit convention.** omega 282 degrees is taken as Lienhard et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.05) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
