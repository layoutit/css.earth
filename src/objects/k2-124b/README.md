# K2-124 b

## Sources

It is the only planet known around K2-124. Its orbit and size follow Livingston et al. 2019's fit, the archive's default. The introduction is generated from Livingston et al. 2019's published values; the sections below are the data's own.

**Size and mass.** Radius 0.25872067 Jupiter radii from Livingston et al. 2019 (2019AJ....157..102L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157..102L/abstract): 18,496.5 km at 71,492 km per Jupiter radius. GM from the mass 0.0275 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Livingston et al. 2019 (2019AJ....157..102L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL__2019): P 6.413651 d Livingston et al. 2019 (2019AJ....157..102L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL__2019): a/R* 28; Livingston et al. 2019 (2019AJ....157..102L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL__2019): inclination 89.03 degrees Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): e 0.08 Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): omega -26.8 degrees, stored as 333.2 Livingston et al. 2019 (2019AJ....157..102L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL__2019): transit mid-time 2457142.18106 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 32 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-124's measured colour (#ffc98f, the colour dataset of k2-124 (src/objects/k2-124/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-124's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (45, 46, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-124b.json).

## Known problems

- **Orbit convention.** omega -26.8 degrees is taken as Dressing et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.08) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
