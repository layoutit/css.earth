# Kepler-138 c

## Sources

It is one of 4 planets known around Kepler-138. Its orbit and size follow Piaulet et al. 2023's fit, the archive's default. The introduction is generated from Piaulet et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.13471341 Jupiter radii from Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023NatAs...7..206P/abstract): 9,630.9 km at 71,492 km per Jupiter radius. GM from the mass 0.00723661 Jupiter masses (Piaulet et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023NatAs...7..206P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023NatAs...7..206P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): P 13.7810915 d Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive ps table (pl_refname PIAULET_ET_AL_2023): a/R* 37; Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive ps table (pl_refname PIAULET_ET_AL_2023): inclination 89.02 degrees Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive ps table (pl_refname PIAULET_ET_AL_2023): e 0.017 Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive ps table (pl_refname PIAULET_ET_AL_2023): omega 34 degrees Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): transit mid-time 2454955.728667 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by kepler-138's measured colour (#ffbd89, the colour dataset of kepler-138 (src/objects/kepler-138/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Kepler-138's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (80, 81, 82), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kepler-138c.json).

## Known problems

- **Orbit convention.** omega 34 degrees is taken as Piaulet et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.017) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
