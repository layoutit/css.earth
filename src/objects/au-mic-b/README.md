# AU Mic b

## Sources

It is one of 4 planets known around AU Mic. Its orbit and size follow Mallorquín et al. 2024's fit, the archive's default. The introduction is generated from Mallorquín et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.42733591 Jupiter radii from Mallorquín et al. 2024 (2024A&A...689A.132M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...689A.132M/abstract): 30,551.1 km at 71,492 km per Jupiter radius. GM from the mass 0.0282857 Jupiter masses (Mallorquín et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...689A.132M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...689A.132M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Zicher et al. 2022 (2022MNRAS.512.3060Z), via the NASA Exoplanet Archive ps table (pl_refname ZICHER_ET_AL__2022): P 8.463 d Mallorquín et al. 2024 (2024A&A...689A.132M), via the NASA Exoplanet Archive ps table (pl_refname MALLORQUIN_ET_AL_2024): a/R* 17.51; Mallorquín et al. 2024 (2024A&A...689A.132M), via the NASA Exoplanet Archive ps table (pl_refname MALLORQUIN_ET_AL_2024): inclination 88.39 degrees Mallorquín et al. 2024 (2024A&A...689A.132M), via the NASA Exoplanet Archive ps table (pl_refname MALLORQUIN_ET_AL_2024): e 0.07 Mallorquín et al. 2024 (2024A&A...689A.132M), via the NASA Exoplanet Archive ps table (pl_refname MALLORQUIN_ET_AL_2024): omega -52 degrees, stored as 308 Zicher et al. 2022 (2022MNRAS.512.3060Z), via the NASA Exoplanet Archive ps table (pl_refname ZICHER_ET_AL__2022): transit mid-time 2458330.39051 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by au-mic's measured color (#ffc08b, the color dataset of au-mic (src/objects/au-mic/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of AU Mic's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (1, 27, 95), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/au-mic-b.json).

## Known problems

- **Orbit convention.** omega -52 degrees is taken as Mallorquín et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.07) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
