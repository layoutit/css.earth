# HD 183579 b

## Sources

It is the only planet known around HD 183579. Its orbit and size follow Bonfanti et al. 2023's fit, the archive's default. The introduction is generated from Bonfanti et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.31135748 Jupiter radii from Bonfanti et al. 2023 (2023A&A...671L...8B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...671L...8B/abstract): 22,259.6 km at 71,492 km per Jupiter radius. GM from the mass 0.06418558 Jupiter masses (Bonfanti et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023A&A...671L...8B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023A&A...671L...8B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Gan et al. 2021 (2021MNRAS.507.2220G), via the NASA Exoplanet Archive ps table (pl_refname GAN_ET_AL__2021): P 17.471275 d Bonfanti et al. 2023 (2023A&A...671L...8B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2023): a/R* derived from its semi-major axis 0.1322 au and stellar radius 0.96 solar radii; Bonfanti et al. 2023 (2023A&A...671L...8B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2023): inclination 89.11 degrees Bonfanti et al. 2023 (2023A&A...671L...8B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2023): e 0.061 Bonfanti et al. 2023 (2023A&A...671L...8B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2023): omega 270 degrees Gan et al. 2021 (2021MNRAS.507.2220G), via the NASA Exoplanet Archive ps table (pl_refname GAN_ET_AL__2021): transit mid-time 2458661.06279 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-183579's measured colour (#fff4f5, the colour dataset of hd-183579 (src/objects/hd-183579/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 183579's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (67, 94, 104), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-183579b.json).

## Known problems

- **Orbit convention.** omega 270 degrees is taken as Bonfanti et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.061) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
