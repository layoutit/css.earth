# TOI-220 b

## Sources

It is the only planet known around TOI-220. Its orbit and size follow Hoyer et al. 2021's fit, the archive's default. The introduction is generated from Hoyer et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 0.27031896 Jupiter radii from Hoyer et al. 2021 (2021MNRAS.505.3361H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.505.3361H/abstract): 19,325.6 km at 71,492 km per Jupiter radius. GM from the mass 0.04341966 Jupiter masses (Hoyer et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021MNRAS.505.3361H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021MNRAS.505.3361H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 10.69530651172 d Hoyer et al. 2021 (2021MNRAS.505.3361H), via the NASA Exoplanet Archive ps table (pl_refname HOYER_ET_AL__2021): a/R* 22.33; Hoyer et al. 2021 (2021MNRAS.505.3361H), via the NASA Exoplanet Archive ps table (pl_refname HOYER_ET_AL__2021): inclination 87.88 degrees Hoyer et al. 2021 (2021MNRAS.505.3361H), via the NASA Exoplanet Archive ps table (pl_refname HOYER_ET_AL__2021): e 0.032 Hoyer et al. 2021 (2021MNRAS.505.3361H), via the NASA Exoplanet Archive ps table (pl_refname HOYER_ET_AL__2021): omega 248 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460966.946848 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-220's measured colour (#ffebe1, the colour dataset of toi-220 (src/objects/toi-220/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-220's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (96, 97, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-220b.json).

## Known problems

- **Orbit convention.** omega 248 degrees is taken as Hoyer et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.032) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
