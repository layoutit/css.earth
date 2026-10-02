# TOI-778 b

## Sources

It is the only planet known around TOI-778. Its orbit and size follow Clark et al. 2023's fit, the archive's default. The introduction is generated from Clark et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 1.37 Jupiter radii from Clark et al. 2023 (2023AJ....165..207C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..207C/abstract): 97,944 km at 71,492 km per Jupiter radius. GM from the mass 2.8 Jupiter masses (Clark et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....165..207C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....165..207C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 4.6336155 d Clark et al. 2023 (2023AJ....165..207C), via the NASA Exoplanet Archive ps table (pl_refname CLARK_ET_AL__2023): a/R* 7.6; Clark et al. 2023 (2023AJ....165..207C), via the NASA Exoplanet Archive ps table (pl_refname CLARK_ET_AL__2023): inclination 84.7 degrees Clark et al. 2023 (2023AJ....165..207C), via the NASA Exoplanet Archive ps table (pl_refname CLARK_ET_AL__2023): e 0.21 Clark et al. 2023 (2023AJ....165..207C), via the NASA Exoplanet Archive ps table (pl_refname CLARK_ET_AL__2023): omega 28 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459574.942709 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-778's measured color (#eaeaff, the color dataset of toi-778 (src/objects/toi-778/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-778's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (10, 37, 91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-778b.json).

## Known problems

- **Orbit convention.** omega 28 degrees is taken as Clark et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.21) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
