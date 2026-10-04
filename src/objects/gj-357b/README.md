# GJ 357 b

## Sources

It is one of 3 planets known around GJ 357. Its orbit and size follow Oddo et al. 2023's fit, the archive's default. The introduction is generated from Oddo et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.10705701 Jupiter radii from Oddo et al. 2023 (2023AJ....165..134O), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..134O/abstract): 7,653.7 km at 71,492 km per Jupiter radius. GM from the mass 0.00575782 Jupiter masses (Weisserman et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026A&A...709A.165W), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026A&A...709A.165W/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Oddo et al. 2023 (2023AJ....165..134O), via the NASA Exoplanet Archive ps table (pl_refname ODDO_ET_AL__2023): P 3.9306 d Oddo et al. 2023 (2023AJ....165..134O), via the NASA Exoplanet Archive ps table (pl_refname ODDO_ET_AL__2023): a/R* 22.89; Oddo et al. 2023 (2023AJ....165..134O), via the NASA Exoplanet Archive ps table (pl_refname ODDO_ET_AL__2023): inclination 89.228 degrees No archive row states an eccentricity; the orbit is taken as circular Oddo et al. 2023 (2023AJ....165..134O), via the NASA Exoplanet Archive ps table (pl_refname ODDO_ET_AL__2023): transit mid-time 2459272.6757 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by gj-357's measured color (#ffc484, the color dataset of gj-357 (src/objects/gj-357/source/photometry/stellar-color.json)) at the gray's own brightness.

**Measured day side.** The page opens on the one thing measured of its surface: a dayside brightness temperature of 923 K at 15 µm (Zgraggen et al. 2026, dayside brightness temperature at 15 µm, 923 +39 -38 K, from an occultation depth of 200.5 +/- 12.7 ppm in F1500W; [record](source/photometry/dayside-temperature.json)). Read from the paper (abstract): the paper's one band; it calls this day side anomalously hot for the planet's orbit; the larger of its two errors is kept. The `measured-dayside` format paints the hemisphere under the star in false color at that temperature, on the 300 to 3,000 K scale every measured day side shares, and leaves the night hemisphere blank. It is too cool for a visible glow, so no black-body color is shown.

**Charts.** The orbits of GJ 357's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (62, 89, 99), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-357b.json).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
