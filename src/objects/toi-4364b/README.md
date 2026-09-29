# TOI-4364 b

## Sources

It is the only planet known around TOI-4364. Its orbit and size follow Distler et al. 2025's fit, the archive's default. This account was drafted from Distler et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.1793205 Jupiter radii from Distler et al. 2025 (2025AJ....169..166D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169..166D/abstract): 12,820 km at 71,492 km per Jupiter radius. GM from the mass 0.0148 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Distler et al. 2025 (2025AJ....169..166D), via the NASA Exoplanet Archive ps table (pl_refname DISTLER_ET_AL__2025): P 5.424019 d Distler et al. 2025 (2025AJ....169..166D), via the NASA Exoplanet Archive ps table (pl_refname DISTLER_ET_AL__2025): a/R* 21.83; Distler et al. 2025 (2025AJ....169..166D), via the NASA Exoplanet Archive ps table (pl_refname DISTLER_ET_AL__2025): inclination 88.68 degrees Distler et al. 2025 (2025AJ....169..166D), via the NASA Exoplanet Archive ps table (pl_refname DISTLER_ET_AL__2025): e 0.29 Distler et al. 2025 (2025AJ....169..166D), via the NASA Exoplanet Archive ps table (pl_refname DISTLER_ET_AL__2025): omega -190 degrees, stored as 170 Distler et al. 2025 (2025AJ....169..166D), via the NASA Exoplanet Archive ps table (pl_refname DISTLER_ET_AL__2025): transit mid-time 2458439.3428 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 7 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-4364's measured colour (#ffc689, the colour lens of toi-4364 (src/objects/toi-4364/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4364's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (5, 32, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4364b.json).


## Known problems

- **Orbit convention.** omega -190 degrees is taken as Distler et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.29) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
