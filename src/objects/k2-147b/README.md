# K2-147 b

## Sources

It is the only planet known around K2-147. Its orbit and size follow Thygesen et al. 2023's fit, the archive's default. This account was drafted from Thygesen et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.1314 Jupiter radii from Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract): 9,394 km at 71,492 km per Jupiter radius. GM from the mass 0.00872 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Adams et al. 2021 (2021PSJ.....2..152A), via the NASA Exoplanet Archive ps table (pl_refname ADAMS_ET_AL__2021): P 0.961918 d Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): a/R* 5.86; Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): inclination 83.6 degrees Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): e 0.38 Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): omega 40 degrees Adams et al. 2021 (2021PSJ.....2..152A), via the NASA Exoplanet Archive ps table (pl_refname ADAMS_ET_AL__2021): transit mid-time 2457327.91683 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 72 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-147's measured colour (#ffc48f, the colour lens of k2-147 (src/objects/k2-147/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-147's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-147b.json).


## Known problems

- **Orbit convention.** omega 40 degrees is taken as Thygesen et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.38) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
