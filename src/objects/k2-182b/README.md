# K2-182 b

## Sources

It is the only planet known around K2-182. Its orbit and size follow Thygesen et al. 2023's fit, the archive's default. The introduction is generated from Thygesen et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.242 Jupiter radii from Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract): 17,301.1 km at 71,492 km per Jupiter radius. GM from the mass 0.066 Jupiter masses (Thygesen et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....165..155T), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): P 4.7369696 d Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): a/R* 14.11; Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): inclination 88.91 degrees Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): e 0.071 Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): omega -160 degrees, stored as 200 Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): transit mid-time 2457652.79755 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-182's measured colour (#ffe3d0, the colour dataset of k2-182 (src/objects/k2-182/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-182's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (45, 46, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-182b.json).

## Known problems

- **Orbit convention.** omega -160 degrees is taken as Thygesen et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.071) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
