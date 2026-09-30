# TOI-7393 b

## Sources

It is the only planet known around TOI-7393. Its orbit and size follow Premnath et al. 2026's fit, the archive's default. The introduction is generated from Premnath et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 1.01 Jupiter radii from Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172...92P/abstract): 72,206.9 km at 71,492 km per Jupiter radius. GM from the mass 0.61 Jupiter masses (Premnath et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026AJ....172...92P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026AJ....172...92P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): P 3.33708 d Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): a/R* 13.26; Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): inclination 86.43 degrees Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): e 0.1198 Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): omega 115 degrees Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): transit mid-time 2460369.40819 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-7393's measured colour (#ffc297, the colour dataset of toi-7393 (src/objects/toi-7393/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-7393's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (76, 77), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-7393b.json).

## Known problems

- **Orbit convention.** omega 115 degrees is taken as Premnath et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.1198) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
