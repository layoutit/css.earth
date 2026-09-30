# HD 110082 b

## Sources

It is the only planet known around HD 110082. Its orbit and size follow Tofflemire et al. 2021's fit, the archive's default. This account was drafted from Tofflemire et al. 2021's values; the sections below are the data's own.

**Size and mass.** Radius 0.28548488 Jupiter radii from Tofflemire et al. 2021 (2021AJ....161..171T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..171T/abstract): 20,409.9 km at 71,492 km per Jupiter radius. GM from the mass 0.0325 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 10.1826982735 d Tofflemire et al. 2021 (2021AJ....161..171T), via the NASA Exoplanet Archive ps table (pl_refname TOFFLEMIRE_ET_AL__2021): a/R* 20; Tofflemire et al. 2021 (2021AJ....161..171T), via the NASA Exoplanet Archive ps table (pl_refname TOFFLEMIRE_ET_AL__2021): inclination 88.2 degrees Tofflemire et al. 2021 (2021AJ....161..171T), via the NASA Exoplanet Archive ps table (pl_refname TOFFLEMIRE_ET_AL__2021): e 0.2 Tofflemire et al. 2021 (2021AJ....161..171T), via the NASA Exoplanet Archive ps table (pl_refname TOFFLEMIRE_ET_AL__2021): omega 138 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458629.909082 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-110082's measured colour (#f7f3ff, the colour dataset of hd-110082 (src/objects/hd-110082/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 110082's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (67, 93, 94), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-110082b.json).


## Known problems

- **Orbit convention.** omega 138 degrees is taken as Tofflemire et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.2) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
