# TOI-5344 b

## Sources

It is the only planet known around TOI-5344. Its orbit and size follow Hartman et al. 2023's fit, the archive's default. The introduction is generated from Hartman et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.946 Jupiter radii from Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166..163H/abstract): 67,631.4 km at 71,492 km per Jupiter radius. GM from the mass 0.412 Jupiter masses (Hartman et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166..163H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166..163H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): P 3.792622 d Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): a/R* 14.78; Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): inclination 87.15 degrees Han et al. 2024 (2024AJ....167....4H), via the NASA Exoplanet Archive ps table (pl_refname HAN_ET_AL_2024): e 0.06 Han et al. 2024 (2024AJ....167....4H), via the NASA Exoplanet Archive ps table (pl_refname HAN_ET_AL_2024): omega 95 degrees Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): transit mid-time 2459848.9903 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-5344's measured colour (#ffb97a, the colour dataset of toi-5344 (src/objects/toi-5344/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-5344's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-5344b.json).

## Known problems

- **Orbit convention.** omega 95 degrees is taken as Han et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.06) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
