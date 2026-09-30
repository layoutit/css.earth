# HAT-P-20 b

## Sources

It is the only planet known around HAT-P-20. Its orbit and size follow Bakos et al. 2010's fit, the archive's default. The introduction is generated from Bakos et al. 2010's published values; the sections below are the data's own.

**Size and mass.** Radius 0.867 Jupiter radii from Bakos et al. 2010 (2010arXiv1008.3388B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2010arXiv1008.3388B/abstract): 61,983.6 km at 71,492 km per Jupiter radius. GM from the mass 7.246 Jupiter masses (Bakos et al. 2010, the mass the NASA Exoplanet Archive's composite table adopts (2010arXiv1008.3388B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2010arXiv1008.3388B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 2.87531773 d Bakos et al. 2010 (2010arXiv1008.3388B), via the NASA Exoplanet Archive ps table (pl_refname BAKOS_ET_AL__2010): a/R* 11.17; Bakos et al. 2010 (2010arXiv1008.3388B), via the NASA Exoplanet Archive ps table (pl_refname BAKOS_ET_AL__2010): inclination 86.8 degrees Bakos et al. 2010 (2010arXiv1008.3388B), via the NASA Exoplanet Archive ps table (pl_refname BAKOS_ET_AL__2010): e 0.015 Bakos et al. 2010 (2010arXiv1008.3388B), via the NASA Exoplanet Archive ps table (pl_refname BAKOS_ET_AL__2010): omega 317 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2457959.12043 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hat-p-20's measured colour (#ffcaa7, the colour dataset of hat-p-20 (src/objects/hat-p-20/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HAT-P-20's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (46, 71, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-20b.json).

## Known problems

- **Orbit convention.** omega 317 degrees is taken as Bakos et al. 2010 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.015) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
