# TOI-942 c

## Sources

It is one of 2 planets known around TOI-942. Its orbit and size follow Wirth et al. 2021's fit, the archive's default. The introduction is generated from Wirth et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 0.41663021 Jupiter radii from Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021ApJ...917L..34W/abstract): 29,785.7 km at 71,492 km per Jupiter radius. No mass is measured: Carleo et al. 2021 (2021A&A...645A..71C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021A&A...645A..71C/abstract) gives only an upper limit of 0.11641444 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): P 10.156272 d Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): a/R* derived from its semi-major axis 0.08598 au and stellar radius 0.894 solar radii; Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): inclination 89.16 degrees Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): e 0.32 Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): omega 20 degrees Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): transit mid-time 2458447.0563 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 14 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-942's measured color (#ffe0cb, the color dataset of toi-942 (src/objects/toi-942/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-942's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (32, 98, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-942c.json).

## Known problems

- **Orbit convention.** omega 20 degrees is taken as Wirth et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.32) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
