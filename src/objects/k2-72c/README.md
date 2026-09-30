# K2-72 c

## Sources

It is one of 4 planets known around K2-72. Its orbit and size follow Dressing et al. 2017's fit, the archive's default. The introduction is generated from Dressing et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 0.10348827 Jupiter radii from Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....154..207D/abstract): 7,398.6 km at 71,492 km per Jupiter radius. GM from the mass 0.00521 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): P 15.189034 d Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): a/R* 47.82; Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): inclination 89.54 degrees Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): e 0.11 Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): omega 16.83 degrees Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): transit mid-time 2456989.465 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1203 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-72's measured colour (#ffc383, the colour dataset of k2-72 (src/objects/k2-72/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-72's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (42), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-72c.json).

## Known problems

- **Orbit convention.** omega 16.83 degrees is taken as Dressing et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.11) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
