# TOI-3884 b

## Sources

It is the only planet known around TOI-3884. Its orbit and size follow Libby-Roberts et al. 2023's fit, the archive's default. The introduction is generated from Libby-Roberts et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.57364716 Jupiter radii from Libby-Roberts et al. 2023 (2023AJ....165..249L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..249L/abstract): 41,011.2 km at 71,492 km per Jupiter radius. GM from the mass 0.10253961 Jupiter masses (Libby-Roberts et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....165..249L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....165..249L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 4.5445569 d Libby-Roberts et al. 2023 (2023AJ....165..249L), via the NASA Exoplanet Archive ps table (pl_refname LIBBY_ROBERTS_ET_AL__2023): a/R* 25.9; Libby-Roberts et al. 2023 (2023AJ....165..249L), via the NASA Exoplanet Archive ps table (pl_refname LIBBY_ROBERTS_ET_AL__2023): inclination 89.81 degrees Libby-Roberts et al. 2023 (2023AJ....165..249L), via the NASA Exoplanet Archive ps table (pl_refname LIBBY_ROBERTS_ET_AL__2023): e 0.06 Libby-Roberts et al. 2023 (2023AJ....165..249L), via the NASA Exoplanet Archive ps table (pl_refname LIBBY_ROBERTS_ET_AL__2023): omega -112 degrees, stored as 248 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459656.499824 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-3884's measured color (#ffbd79, the color dataset of toi-3884 (src/objects/toi-3884/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-3884's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (46, 49), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-3884b.json).

## Known problems

- **Orbit convention.** omega -112 degrees is taken as Libby-Roberts et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.06) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
