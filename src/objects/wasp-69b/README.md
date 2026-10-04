# WASP-69 b

## Sources

It is the only planet known around Wouri. Its orbit and size follow Allart et al. 2025's fit, the archive's default. The introduction is generated from Allart et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 1 Jupiter radii from Allart et al. 2025 (2025A&A...700A...7A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...700A...7A/abstract): 71,492 km at 71,492 km per Jupiter radius. GM from the mass 0.26 Jupiter masses (Allart et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...700A...7A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...700A...7A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Allart et al. 2025 (2025A&A...700A...7A), via the NASA Exoplanet Archive ps table (pl_refname ALLART_ET_AL__2025): P 3.86813881 d Allart et al. 2025 (2025A&A...700A...7A), via the NASA Exoplanet Archive ps table (pl_refname ALLART_ET_AL__2025): a/R* 12.17; Allart et al. 2025 (2025A&A...700A...7A), via the NASA Exoplanet Archive ps table (pl_refname ALLART_ET_AL__2025): inclination 86.79 degrees Allart et al. 2025 (2025A&A...700A...7A), via the NASA Exoplanet Archive ps table (pl_refname ALLART_ET_AL__2025): e 0 Allart et al. 2025 (2025A&A...700A...7A), via the NASA Exoplanet Archive ps table (pl_refname ALLART_ET_AL__2025): transit mid-time 2455748.83428 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by wasp-69's measured color (#ffd7be, the color dataset of wasp-69 (src/objects/wasp-69/source/photometry/stellar-color.json)) at the gray's own brightness.

**Measured day side.** The page opens on the one thing measured of its surface: a dayside brightness temperature of 949 K at 4.5 µm (Deming et al. 2023, dayside brightness temperature at 4.5 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2); [record](source/photometry/dayside-temperature.json)). Chosen by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. The `measured-dayside` format paints the hemisphere under the star in false color at that temperature, on the 300 to 3,000 K scale every measured day side shares, and leaves the night hemisphere blank. It is too cool for a visible glow, so no black-body color is shown.

**Charts.** The orbits of Wouri's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (55, 81, 92), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-69b.json).


[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
