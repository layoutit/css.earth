# TOI-5713 b

## Sources

It is the only planet known around TOI-5713. Its orbit and size follow Ghachoui et al. 2024's fit, the archive's default. This account was drafted from Ghachoui et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.1579091 Jupiter radii from Ghachoui et al. 2024 (2024A&A...690A.263G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...690A.263G/abstract): 11,289.2 km at 71,492 km per Jupiter radius. GM from the mass 0.0119 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Ghachoui et al. 2024 (2024A&A...690A.263G), via the NASA Exoplanet Archive ps table (pl_refname GHACHOUI_ET_AL__2024): P 10.441989 d Ghachoui et al. 2024 (2024A&A...690A.263G), via the NASA Exoplanet Archive ps table (pl_refname GHACHOUI_ET_AL__2024): a/R* 43.2; Ghachoui et al. 2024 (2024A&A...690A.263G), via the NASA Exoplanet Archive ps table (pl_refname GHACHOUI_ET_AL__2024): inclination 89.37 degrees Ghachoui et al. 2024 (2024A&A...690A.263G), via the NASA Exoplanet Archive ps table (pl_refname GHACHOUI_ET_AL__2024): e 0.24 Ghachoui et al. 2024 (2024A&A...690A.263G), via the NASA Exoplanet Archive ps table (pl_refname GHACHOUI_ET_AL__2024): omega -139 degrees, stored as 221 Ghachoui et al. 2024 (2024A&A...690A.263G), via the NASA Exoplanet Archive ps table (pl_refname GHACHOUI_ET_AL__2024): transit mid-time 2458745.6776 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-5713's measured colour (#ffca81, the colour lens of toi-5713 (src/objects/toi-5713/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-5713's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (23, 49, 76), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-5713b.json).


## Known problems

- **Orbit convention.** omega -139 degrees is taken as Ghachoui et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.24) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
