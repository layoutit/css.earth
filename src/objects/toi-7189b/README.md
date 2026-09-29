# TOI-7189 b

## Sources

It is the only planet known around TOI-7189. Its orbit and size follow Premnath et al. 2026's fit, the archive's default. This account was drafted from Premnath et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.98 Jupiter radii from Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172...92P/abstract): 70,062.2 km at 71,492 km per Jupiter radius. GM from the mass 0.5 Jupiter masses (Premnath et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026AJ....172...92P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026AJ....172...92P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): P 2.89055 d Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): a/R* 12.21; Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): inclination 88.41 degrees Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): e 0.0601 Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): omega -10.1 degrees, stored as 349.9 Premnath et al. 2026 (2026AJ....172...92P), via the NASA Exoplanet Archive ps table (pl_refname PREMNATH_ET_AL_2026): transit mid-time 2460503.94932 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-7189's measured colour (#ffc186, the colour lens of toi-7189 (src/objects/toi-7189/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-7189's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-7189b.json).


## Known problems

- **Orbit convention.** omega -10.1 degrees is taken as Premnath et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0601) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
