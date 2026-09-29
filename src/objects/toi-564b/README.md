# TOI-564 b

## Sources

It is the only planet known around TOI-564. Its orbit and size follow Davis et al. 2020's fit, the archive's default. This account was drafted from Davis et al. 2020's values; the sections below are the data's own.

**Size and mass.** Radius 1.02 Jupiter radii from Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..229D/abstract): 72,921.8 km at 71,492 km per Jupiter radius. GM from the mass 1.463 Jupiter masses (Davis et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020AJ....160..229D), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020AJ....160..229D/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 1.6511442 d Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive ps table (pl_refname DAVIS_ET_AL__2020): a/R* derived from its semi-major axis 0.02734 au and stellar radius 1.088 solar radii; Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive ps table (pl_refname DAVIS_ET_AL__2020): inclination 78.38 degrees Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive ps table (pl_refname DAVIS_ET_AL__2020): e 0.072 Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive ps table (pl_refname DAVIS_ET_AL__2020): omega 94 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2458950.80383 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-564's measured colour (#ffeee6, the colour lens of toi-564 (src/objects/toi-564/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-564's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (61, 88, 99), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-564b.json).


## Known problems

- **Orbit convention.** omega 94 degrees is taken as Davis et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.072) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
