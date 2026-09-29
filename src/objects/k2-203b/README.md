# K2-203 b

## Sources

It is the only planet known around K2-203. Its orbit and size follow Thygesen et al. 2023's fit, the archive's default. This account was drafted from Thygesen et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.1129 Jupiter radii from Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract): 8,071.4 km at 71,492 km per Jupiter radius. GM from the mass 0.00674 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Mayo et al. 2018 (2018AJ....155..136M), via the NASA Exoplanet Archive ps table (pl_refname MAYO_ET_AL__2018): P 9.695101 d Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): a/R* 23.16; Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): inclination 89.12 degrees Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): e 0.23 Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): omega -124 degrees, stored as 236 Mayo et al. 2018 (2018AJ....155..136M), via the NASA Exoplanet Archive ps table (pl_refname MAYO_ET_AL__2018): transit mid-time 2457396.63878 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 696 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-203's measured colour (#ffe0cb, the colour lens of k2-203 (src/objects/k2-203/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-203's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-203b.json).


## Known problems

- **Orbit convention.** omega -124 degrees is taken as Thygesen et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.23) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
