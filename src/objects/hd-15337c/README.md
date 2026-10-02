# HD 15337 c

## Sources

It is one of 2 planets known around HD 15337. Its orbit and size follow Rosário et al. 2024's fit, the archive's default. The introduction is generated from Rosário et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.22535501 Jupiter radii from Rosário et al. 2024 (2024A&A...686A.282R), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...686A.282R/abstract): 16,111.1 km at 71,492 km per Jupiter radius. GM from the mass 0.02137002 Jupiter masses (Rosário et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...686A.282R), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...686A.282R/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 17.17966727335 d Rosário et al. 2024 (2024A&A...686A.282R), via the NASA Exoplanet Archive ps table (pl_refname ROS_AMP_AACUTE_RIO_ET_AL__2024): a/R* derived by Kepler's third law from its period 17.17966727335 d, stellar mass 0.829 and radius 0.855 solar units; Rosário et al. 2024 (2024A&A...686A.282R), via the NASA Exoplanet Archive ps table (pl_refname ROS_AMP_AACUTE_RIO_ET_AL__2024): inclination 88.41 degrees Rosário et al. 2024 (2024A&A...686A.282R), via the NASA Exoplanet Archive ps table (pl_refname ROS_AMP_AACUTE_RIO_ET_AL__2024): e 0.096 Rosário et al. 2024 (2024A&A...686A.282R), via the NASA Exoplanet Archive ps table (pl_refname ROS_AMP_AACUTE_RIO_ET_AL__2024): omega 56.63 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460974.324328 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by hd-15337's measured color (#ffe5d5, the color dataset of hd-15337 (src/objects/hd-15337/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 15337's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (97, 105, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-15337c.json).

## Known problems

- **Orbit convention.** omega 56.63 degrees is taken as Rosário et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.096) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
