# K2-266 d

## Sources

It is one of 4 planets known around K2-266. Its orbit and size follow Rodriguez et al. 2018's fit, the archive's default. The introduction is generated from Rodriguez et al. 2018's published values; the sections below are the data's own.

**Size and mass.** Radius 0.26139709 Jupiter radii from Rodriguez et al. 2018 (2018AJ....156..245R), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156..245R/abstract): 18,687.8 km at 71,492 km per Jupiter radius. GM from the mass 0.02800239 Jupiter masses (Rodriguez et al. 2018, the mass the NASA Exoplanet Archive's composite table adopts (2018AJ....156..245R), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2018AJ....156..245R/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 14.69808003166 d Rodriguez et al. 2018 (2018AJ....156..245R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2018): a/R* 31.7; Rodriguez et al. 2018 (2018AJ....156..245R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2018): inclination 89.46 degrees Rodriguez et al. 2018 (2018AJ....156..245R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2018): e 0.047 Rodriguez et al. 2018 (2018AJ....156..245R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2018): omega 87 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459267.668855 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 12 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by k2-266's measured color (#ffd9b2, the color dataset of k2-266 (src/objects/k2-266/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-266's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (62, 72, 89), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-266d.json).

## Known problems

- **Orbit convention.** omega 87 degrees is taken as Rodriguez et al. 2018 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.047) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
