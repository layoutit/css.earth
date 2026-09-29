# Kepler-138 d

## Sources

It is one of 4 planets known around Kepler-138. Its orbit and size follow Piaulet et al. 2023's fit, the archive's default. This account was drafted from Piaulet et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.13471341 Jupiter radii from Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023NatAs...7..206P/abstract): 9,630.9 km at 71,492 km per Jupiter radius. GM from the mass 0.00660734 Jupiter masses (Piaulet et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023NatAs...7..206P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023NatAs...7..206P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): P 23.08898875 d Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive ps table (pl_refname PIAULET_ET_AL_2023): a/R* 51.8; Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive ps table (pl_refname PIAULET_ET_AL_2023): inclination 89.04 degrees Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive ps table (pl_refname PIAULET_ET_AL_2023): e 0.01 Piaulet et al. 2023 (2023NatAs...7..206P), via the NASA Exoplanet Archive ps table (pl_refname PIAULET_ET_AL_2023): omega 250 degrees Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): transit mid-time 2454957.828571 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by kepler-138's measured colour (#ffbd89, the colour lens of kepler-138 (src/objects/kepler-138/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Kepler-138's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kepler-138d.json).


## Known problems

- **Orbit convention.** omega 250 degrees is taken as Piaulet et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.01) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
