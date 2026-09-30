# HD 110113 b

## Sources

It is one of 2 planets known around HD 110113. Its orbit and size follow Osborn et al. 2021's fit, the archive's default. The introduction is generated from Osborn et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 0.18288875 Jupiter radii from Osborn et al. 2021 (2021MNRAS.502.4842O), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.502.4842O/abstract): 13,075.1 km at 71,492 km per Jupiter radius. GM from the mass 0.01431583 Jupiter masses (Osborn et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021MNRAS.502.4842O), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021MNRAS.502.4842O/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 2.54047309 d Osborn et al. 2021 (2021MNRAS.502.4842O), via the NASA Exoplanet Archive ps table (pl_refname OSBORN_ET_AL__2021): a/R* derived from its semi-major axis 0.035 au and stellar radius 0.968 solar radii; Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): inclination 87.69 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.093 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 359.53 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2459103.603217 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-110113's measured colour (#fff2ed, the colour dataset of hd-110113 (src/objects/hd-110113/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 110113's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (64, 100, 101), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-110113b.json).

## Known problems

- **Orbit convention.** omega 359.53 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.093) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
