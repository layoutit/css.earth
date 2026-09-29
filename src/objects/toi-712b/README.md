# TOI-712 b

## Sources

It is one of 3 planets known around TOI-712. Its orbit and size follow Vach et al. 2022's fit, the archive's default. This account was drafted from Vach et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.18279985 Jupiter radii from Vach et al. 2022 (2022AJ....164...71V), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...71V/abstract): 13,068.7 km at 71,492 km per Jupiter radius. GM from the mass 0.0153 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 9.53138009666 d Vach et al. 2022 (2022AJ....164...71V), via the NASA Exoplanet Archive ps table (pl_refname VACH_ET_AL__2022): a/R* derived from its semi-major axis 0.07928 au and stellar radius 0.674 solar radii; Vach et al. 2022 (2022AJ....164...71V), via the NASA Exoplanet Archive ps table (pl_refname VACH_ET_AL__2022): inclination 88.22 degrees Vach et al. 2022 (2022AJ....164...71V), via the NASA Exoplanet Archive ps table (pl_refname VACH_ET_AL__2022): e 0.54 Vach et al. 2022 (2022AJ....164...71V), via the NASA Exoplanet Archive ps table (pl_refname VACH_ET_AL__2022): omega 68 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460978.080561 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-712's measured colour (#ffd0b3, the colour lens of toi-712 (src/objects/toi-712/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-712's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (94, 97, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-712b.json).


## Known problems

- **Orbit convention.** omega 68 degrees is taken as Vach et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.54) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
