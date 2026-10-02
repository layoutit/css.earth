# K2-43 b

## Sources

It is one of 2 planets known around K2-43. Its orbit and size follow Hedges et al. 2019's fit, the archive's default. The introduction is generated from Hedges et al. 2019's published values; the sections below are the data's own.

**Size and mass.** Radius 0.40235525 Jupiter radii from Hedges et al. 2019 (2019ApJ...880L...5H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019ApJ...880L...5H/abstract): 28,765.2 km at 71,492 km per Jupiter radius. GM from the mass 0.0583 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 3.4712802624 d Hedges et al. 2019 (2019ApJ...880L...5H), via the NASA Exoplanet Archive ps table (pl_refname HEDGES_ET_AL__2019): a/R* 8; Hedges et al. 2019 (2019ApJ...880L...5H), via the NASA Exoplanet Archive ps table (pl_refname HEDGES_ET_AL__2019): inclination 89.6 degrees Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): e 0.07 Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): omega -25.11 degrees, stored as 334.89 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459281.403586 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 15 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by k2-43's measured color (#ffd09d, the color dataset of k2-43 (src/objects/k2-43/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-43's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (46, 63, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-43b.json).

## Known problems

- **Orbit convention.** omega -25.11 degrees is taken as Dressing et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.07) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
