# K2-287 b

## Sources

It is the only planet known around K2-287. Its orbit and size follow Jordán et al. 2019's fit, the archive's default. This account was drafted from Jordán et al. 2019's values; the sections below are the data's own.

**Size and mass.** Radius 0.847 Jupiter radii from Jordán et al. 2019 (2019AJ....157..100J), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157..100J/abstract): 60,553.7 km at 71,492 km per Jupiter radius. GM from the mass 0.315 Jupiter masses (Jordán et al. 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019AJ....157..100J), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019AJ....157..100J/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Borsato et al. 2021 (2021MNRAS.506.3810B), via the NASA Exoplanet Archive ps table (pl_refname BORSATO_ET_AL_2021): P 14.893289 d Jordán et al. 2019 (2019AJ....157..100J), via the NASA Exoplanet Archive ps table (pl_refname JORD_AACUTE_N_ET_AL__2019): a/R* 23.87; Jordán et al. 2019 (2019AJ....157..100J), via the NASA Exoplanet Archive ps table (pl_refname JORD_AACUTE_N_ET_AL__2019): inclination 88.13 degrees Jordán et al. 2019 (2019AJ....157..100J), via the NASA Exoplanet Archive ps table (pl_refname JORD_AACUTE_N_ET_AL__2019): e 0.478 Jordán et al. 2019 (2019AJ....157..100J), via the NASA Exoplanet Archive ps table (pl_refname JORD_AACUTE_N_ET_AL__2019): omega 10.1 degrees Borsato et al. 2021 (2021MNRAS.506.3810B), via the NASA Exoplanet Archive ps table (pl_refname BORSATO_ET_AL_2021): transit mid-time 2458999.5651 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-287's measured colour (#ffe3ce, the colour lens of k2-287 (src/objects/k2-287/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-287's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-287b.json).


## Known problems

- **Orbit convention.** omega 10.1 degrees is taken as Jordán et al. 2019 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.478) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
