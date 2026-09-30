# HD 86226 c

## Sources

It is one of 2 planets known around HD 86226. Its orbit and size follow Teske et al. 2020's fit, the archive's default. The introduction is generated from Teske et al. 2020's published values; the sections below are the data's own.

**Size and mass.** Radius 0.19270229 Jupiter radii from Teske et al. 2020 (2020AJ....160...96T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160...96T/abstract): 13,776.7 km at 71,492 km per Jupiter radius. GM from the mass 0.02281094 Jupiter masses (Teske et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020AJ....160...96T), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020AJ....160...96T/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 3.9846589 d Teske et al. 2020 (2020AJ....160...96T), via the NASA Exoplanet Archive ps table (pl_refname TESKE_ET_AL__2020): a/R* 10.11; Teske et al. 2020 (2020AJ....160...96T), via the NASA Exoplanet Archive ps table (pl_refname TESKE_ET_AL__2020): inclination 86.45 degrees Teske et al. 2020 (2020AJ....160...96T), via the NASA Exoplanet Archive ps table (pl_refname TESKE_ET_AL__2020): e 0.075 Teske et al. 2020 (2020AJ....160...96T), via the NASA Exoplanet Archive ps table (pl_refname TESKE_ET_AL__2020): omega 196 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460013.591733 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-86226's measured colour (#fff6fa, the colour dataset of hd-86226 (src/objects/hd-86226/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 86226's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (89, 99, 100), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-86226c.json).

## Known problems

- **Orbit convention.** omega 196 degrees is taken as Teske et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.075) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
