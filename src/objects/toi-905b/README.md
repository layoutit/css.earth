# TOI-905 b

## Sources

It is the only planet known around TOI-905. Its orbit and size follow Davis et al. 2020's fit, the archive's default. The introduction is generated from Davis et al. 2020's published values; the sections below are the data's own.

**Size and mass.** Radius 1.171 Jupiter radii from Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..229D/abstract): 83,717.1 km at 71,492 km per Jupiter radius. GM from the mass 0.667 Jupiter masses (Davis et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020AJ....160..229D), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020AJ....160..229D/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 3.73957156087 d Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive ps table (pl_refname DAVIS_ET_AL__2020): a/R* derived from its semi-major axis 0.04666 au and stellar radius 0.918 solar radii; Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive ps table (pl_refname DAVIS_ET_AL__2020): inclination 85.68 degrees Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive ps table (pl_refname DAVIS_ET_AL__2020): e 0.024 Davis et al. 2020 (2020AJ....160..229D), via the NASA Exoplanet Archive ps table (pl_refname DAVIS_ET_AL__2020): omega 39 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458628.349689 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-905's measured colour (#ffe9db, the colour dataset of toi-905 (src/objects/toi-905/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-905's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (100, 101, 102), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-905b.json).

## Known problems

- **Orbit convention.** omega 39 degrees is taken as Davis et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.024) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
