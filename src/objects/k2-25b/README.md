# K2-25 b

## Sources

It is the only planet known around K2-25. Its orbit and size follow Stefansson et al. 2020's fit, the archive's default. This account was drafted from Stefansson et al. 2020's values; the sections below are the data's own.

**Size and mass.** Radius 0.306 Jupiter radii from Stefansson et al. 2020 (2020AJ....160..192S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..192S/abstract): 21,876.6 km at 71,492 km per Jupiter radius. GM from the mass 0.07708562 Jupiter masses (Stefansson et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020AJ....160..192S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020AJ....160..192S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Stefansson et al. 2020 (2020AJ....160..192S), via the NASA Exoplanet Archive ps table (pl_refname STEFANSSON_ET_AL__2020): P 3.48456408 d Stefansson et al. 2020 (2020AJ....160..192S), via the NASA Exoplanet Archive ps table (pl_refname STEFANSSON_ET_AL__2020): a/R* 21.09; Stefansson et al. 2020 (2020AJ....160..192S), via the NASA Exoplanet Archive ps table (pl_refname STEFANSSON_ET_AL__2020): inclination 87.16 degrees Stefansson et al. 2020 (2020AJ....160..192S), via the NASA Exoplanet Archive ps table (pl_refname STEFANSSON_ET_AL__2020): e 0.428 Stefansson et al. 2020 (2020AJ....160..192S), via the NASA Exoplanet Archive ps table (pl_refname STEFANSSON_ET_AL__2020): omega 120 degrees Stefansson et al. 2020 (2020AJ....160..192S), via the NASA Exoplanet Archive ps table (pl_refname STEFANSSON_ET_AL__2020): transit mid-time 2458515.64206 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-25's measured colour (#ffcd83, the colour lens of k2-25 (src/objects/k2-25/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-25's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (44, 70, 71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-25b.json).


## Known problems

- **Orbit convention.** omega 120 degrees is taken as Stefansson et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.428) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
