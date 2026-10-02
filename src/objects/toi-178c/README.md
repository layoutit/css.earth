# TOI-178 c

## Sources

It is one of 6 planets known around TOI-178. Its orbit and size follow Leleu et al. 2024's fit, the archive's default. The introduction is generated from Leleu et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.15648167 Jupiter radii from Leleu et al. 2024 (2024A&A...688A.211L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...688A.211L/abstract): 11,187.2 km at 71,492 km per Jupiter radius. GM from the mass 0.01459907 Jupiter masses (Leleu et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...688A.211L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...688A.211L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Leleu et al. 2021 (2021A&A...649A..26L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2021): P 3.23845 d Leleu et al. 2024 (2024A&A...688A.211L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2024): a/R* derived by Kepler's third law from its period 3.23845 d, stellar mass 0.647 and radius 0.662 solar units; Leleu et al. 2021 (2021A&A...649A..26L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2021): inclination 88.4 degrees Leleu et al. 2024 (2024A&A...688A.211L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2024): e 0.00032 Leleu et al. 2024 (2024A&A...688A.211L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2024): omega 26 degrees Leleu et al. 2021 (2021A&A...649A..26L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2021): transit mid-time 2458741.4783 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 21 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-178's measured color (#ffc8a5, the color dataset of toi-178 (src/objects/toi-178/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-178's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (29, 69, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-178c.json).

## Known problems

- **Orbit convention.** omega 26 degrees is taken as Leleu et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.00032) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
