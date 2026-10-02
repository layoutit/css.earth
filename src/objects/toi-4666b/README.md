# TOI-4666 b

## Sources

It is the only planet known around TOI-4666. Its orbit and size follow Dransfield et al. 2026's fit, the archive's default. The introduction is generated from Dransfield et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 1.118 Jupiter radii from Dransfield et al. 2026 (2026MNRAS.547ag448D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.547ag448D/abstract): 79,928.1 km at 71,492 km per Jupiter radius. GM from the mass 0.489 Jupiter masses (Dransfield et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026MNRAS.547ag448D), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026MNRAS.547ag448D/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Frensch et al. 2026 (2026A&A...707A..73F), via the NASA Exoplanet Archive ps table (pl_refname FRENSCH_ET_AL_2026): P 2.9089168 d Dransfield et al. 2026 (2026MNRAS.547ag448D), via the NASA Exoplanet Archive ps table (pl_refname DRANSFIELD_ET_AL_2026): a/R* 12.45; Dransfield et al. 2026 (2026MNRAS.547ag448D), via the NASA Exoplanet Archive ps table (pl_refname DRANSFIELD_ET_AL_2026): inclination 89.79 degrees Dransfield et al. 2026 (2026MNRAS.547ag448D), via the NASA Exoplanet Archive ps table (pl_refname DRANSFIELD_ET_AL_2026): e 0.023 Dransfield et al. 2026 (2026MNRAS.547ag448D), via the NASA Exoplanet Archive ps table (pl_refname DRANSFIELD_ET_AL_2026): omega 183 degrees Frensch et al. 2026 (2026A&A...707A..73F), via the NASA Exoplanet Archive ps table (pl_refname FRENSCH_ET_AL_2026): transit mid-time 2459168.4744 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-4666's measured color (#ffc189, the color dataset of toi-4666 (src/objects/toi-4666/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4666's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (97, 105, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4666b.json).

## Known problems

- **Orbit convention.** omega 183 degrees is taken as Dransfield et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.023) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
