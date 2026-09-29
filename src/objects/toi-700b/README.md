# TOI-700 b

## Sources

It is one of 4 planets known around TOI-700. Its orbit and size follow Pass et al. 2026's fit, the archive's default. This account was drafted from Pass et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.08591325 Jupiter radii from Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172..175P/abstract): 6,142.1 km at 71,492 km per Jupiter radius. GM from the mass 0.00267 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL_2026): P 9.97722 d Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL_2026): a/R* derived from its semi-major axis 0.0678 au and stellar radius 0.4104 solar radii; Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL_2026): inclination 89.63 degrees Gilbert et al. 2023 (2023ApJ...944L..35G), via the NASA Exoplanet Archive ps table (pl_refname GILBERT_ET_AL_2023): e 0.075 Gilbert et al. 2023 (2023ApJ...944L..35G), via the NASA Exoplanet Archive ps table (pl_refname GILBERT_ET_AL_2023): omega -150 degrees, stored as 210 Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL_2026): transit mid-time 2458880.0994 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-700's measured colour (#ffc789, the colour lens of toi-700 (src/objects/toi-700/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-700's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (95, 96, 97), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-700b.json).


## Known problems

- **Orbit convention.** omega -150 degrees is taken as Gilbert et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.075) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
