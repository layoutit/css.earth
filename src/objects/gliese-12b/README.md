# Gliese 12 b

## Sources

It is the only planet known around Gliese 12. Its orbit and size follow Turner et al. 2026's fit, the archive's default. The introduction is generated from Turner et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.08296919 Jupiter radii from Turner et al. 2026 (2026MNRAS.545f1703T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.545f1703T/abstract): 5,931.6 km at 71,492 km per Jupiter radius. GM from the mass 0.00298903 Jupiter masses (Turner et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026MNRAS.545f1703T), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026MNRAS.545f1703T/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Turner et al. 2026 (2026MNRAS.545f1703T), via the NASA Exoplanet Archive ps table (pl_refname TURNER_ET_AL_2026): P 12.761418 d Turner et al. 2026 (2026MNRAS.545f1703T), via the NASA Exoplanet Archive ps table (pl_refname TURNER_ET_AL_2026): a/R* 55.2; Turner et al. 2026 (2026MNRAS.545f1703T), via the NASA Exoplanet Archive ps table (pl_refname TURNER_ET_AL_2026): inclination 89.25 degrees Turner et al. 2026 (2026MNRAS.545f1703T), via the NASA Exoplanet Archive ps table (pl_refname TURNER_ET_AL_2026): e 0.24 Turner et al. 2026 (2026MNRAS.545f1703T), via the NASA Exoplanet Archive ps table (pl_refname TURNER_ET_AL_2026): omega -16 degrees, stored as 344 Turner et al. 2026 (2026MNRAS.545f1703T), via the NASA Exoplanet Archive ps table (pl_refname TURNER_ET_AL_2026): transit mid-time 2460033.16351 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 7 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by gliese-12's measured colour (#ffc57d, the colour dataset of gliese-12 (src/objects/gliese-12/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Gliese 12's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (57, 70, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gliese-12b.json).

## Known problems

- **Orbit convention.** omega -16 degrees is taken as Turner et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.24) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
