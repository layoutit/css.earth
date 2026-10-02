# TOI-4515 b

## Sources

It is the only planet known around TOI-4515. Its orbit and size follow Carleo et al. 2024's fit, the archive's default. The introduction is generated from Carleo et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 1.086 Jupiter radii from Carleo et al. 2024 (2024A&A...682A.135C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...682A.135C/abstract): 77,640.3 km at 71,492 km per Jupiter radius. GM from the mass 2.005 Jupiter masses (Carleo et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...682A.135C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...682A.135C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Carleo et al. 2024 (2024A&A...682A.135C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL__2024): P 15.266446 d Carleo et al. 2024 (2024A&A...682A.135C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL__2024): a/R* 29.67; Carleo et al. 2024 (2024A&A...682A.135C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL__2024): inclination 87.954 degrees Carleo et al. 2024 (2024A&A...682A.135C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL__2024): e 0.461 Carleo et al. 2024 (2024A&A...682A.135C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL__2024): omega 169.9 degrees Carleo et al. 2024 (2024A&A...682A.135C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL__2024): transit mid-time 2459451.62191 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-4515's measured color (#ffeadc, the color dataset of toi-4515 (src/objects/toi-4515/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4515's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (43, 57, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4515b.json).

## Known problems

- **Orbit convention.** omega 169.9 degrees is taken as Carleo et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.461) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
