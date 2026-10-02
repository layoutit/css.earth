# TOI-125 b

## Sources

It is one of 3 planets known around TOI-125. Its orbit and size follow Nielsen et al. 2020's fit, the archive's default. The introduction is generated from Nielsen et al. 2020's published values; the sections below are the data's own.

**Size and mass.** Radius 0.24319743 Jupiter radii from Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020MNRAS.492.5399N/abstract): 17,386.7 km at 71,492 km per Jupiter radius. GM from the mass 0.02989019 Jupiter masses (Nielsen et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020MNRAS.492.5399N), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020MNRAS.492.5399N/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 4.6517186 d Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive ps table (pl_refname NIELSEN_ET_AL__2020): a/R* 13.16; Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive ps table (pl_refname NIELSEN_ET_AL__2020): inclination 88.92 degrees Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive ps table (pl_refname NIELSEN_ET_AL__2020): e 0.194 Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive ps table (pl_refname NIELSEN_ET_AL__2020): omega -37 degrees, stored as 323 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460206.744249 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-125's measured color (#ffe7d9, the color dataset of toi-125 (src/objects/toi-125/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-125's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (69, 95, 96), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-125b.json).

## Known problems

- **Orbit convention.** omega -37 degrees is taken as Nielsen et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.194) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
