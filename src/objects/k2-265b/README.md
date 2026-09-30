# K2-265 b

## Sources

It is the only planet known around K2-265. Its orbit and size follow Thygesen et al. 2023's fit, the archive's default. The introduction is generated from Thygesen et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.1524 Jupiter radii from Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract): 10,895.4 km at 71,492 km per Jupiter radius. GM from the mass 0.0231 Jupiter masses (Thygesen et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....165..155T), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 2.36916512782 d Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): a/R* 7.86; Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): inclination 87.01 degrees Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): e 0.16 Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): omega -57 degrees, stored as 303 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459090.174433 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 17 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-265's measured colour (#ffebdf, the colour dataset of k2-265 (src/objects/k2-265/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-265's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (42, 70, 92), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-265b.json).

## Known problems

- **Orbit convention.** omega -57 degrees is taken as Thygesen et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.16) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
