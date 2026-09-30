# TOI-2407 b

## Sources

It is the only planet known around TOI-2407. Its orbit and size follow Janó Muñoz et al. 2025's fit, the archive's default. The introduction is generated from Janó Muñoz et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.3800524 Jupiter radii from Janó Muñoz et al. 2025 (2025MNRAS.541..630J), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025MNRAS.541..630J/abstract): 27,170.7 km at 71,492 km per Jupiter radius. GM from the mass 0.0529 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Janó Muñoz et al. 2025 (2025MNRAS.541..630J), via the NASA Exoplanet Archive ps table (pl_refname JANO_MUNOZ_ET_AL_2025): P 2.702969 d Janó Muñoz et al. 2025 (2025MNRAS.541..630J), via the NASA Exoplanet Archive ps table (pl_refname JANO_MUNOZ_ET_AL_2025): a/R* derived from its semi-major axis 0.033 au and stellar radius 0.567 solar radii; Janó Muñoz et al. 2025 (2025MNRAS.541..630J), via the NASA Exoplanet Archive ps table (pl_refname JANO_MUNOZ_ET_AL_2025): inclination 88.83 degrees Janó Muñoz et al. 2025 (2025MNRAS.541..630J), via the NASA Exoplanet Archive ps table (pl_refname JANO_MUNOZ_ET_AL_2025): e 0.08 Janó Muñoz et al. 2025 (2025MNRAS.541..630J), via the NASA Exoplanet Archive ps table (pl_refname JANO_MUNOZ_ET_AL_2025): omega 42 degrees Janó Muñoz et al. 2025 (2025MNRAS.541..630J), via the NASA Exoplanet Archive ps table (pl_refname JANO_MUNOZ_ET_AL_2025): transit mid-time 2459149.0561 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2407's measured colour (#ffc88f, the colour dataset of toi-2407 (src/objects/toi-2407/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2407's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (31, 97, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2407b.json).

## Known problems

- **Orbit convention.** omega 42 degrees is taken as Janó Muñoz et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.08) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
