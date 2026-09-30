# TOI-763 c

## Sources

It is one of 2 planets known around TOI-763. Its orbit and size follow Fridlund et al. 2020's fit, the archive's default. The introduction is generated from Fridlund et al. 2020's published values; the sections below are the data's own.

**Size and mass.** Radius 0.23463288 Jupiter radii from Fridlund et al. 2020 (2020MNRAS.498.4503F), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020MNRAS.498.4503F/abstract): 16,774.4 km at 71,492 km per Jupiter radius. GM from the mass 0.02932385 Jupiter masses (Fridlund et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020MNRAS.498.4503F), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020MNRAS.498.4503F/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 12.27724442374 d Fridlund et al. 2020 (2020MNRAS.498.4503F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2020): a/R* derived from its semi-major axis 0.1011 au and stellar radius 0.897 solar radii; Fridlund et al. 2020 (2020MNRAS.498.4503F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2020): inclination derived from its impact parameter 0.51 with its a/R* 24.2361 and the orbit's e 0.04, omega 62 degrees (Winn 2010, eq. 7) Fridlund et al. 2020 (2020MNRAS.498.4503F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2020): e 0.04 Fridlund et al. 2020 (2020MNRAS.498.4503F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2020): omega 62 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460046.212045 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 6 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-763's measured colour (#ffefe8, the colour dataset of toi-763 (src/objects/toi-763/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-763's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (64, 101, 102), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-763c.json).

## Known problems

- **Orbit convention.** omega 62 degrees is taken as Fridlund et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.04) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
