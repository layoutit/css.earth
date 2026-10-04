# HAT-P-12 b

## Sources

It is the only planet known around Komondor. Its orbit and size follow Hartman et al. 2009's fit, the archive's default. The introduction is generated from Hartman et al. 2009's published values; the sections below are the data's own.

**Size and mass.** Radius 0.959 Jupiter radii from Hartman et al. 2009 (2009ApJ...706..785H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2009ApJ...706..785H/abstract): 68,560.8 km at 71,492 km per Jupiter radius. GM from the mass 0.211 Jupiter masses (Hartman et al. 2009, the mass the NASA Exoplanet Archive's composite table adopts (2009ApJ...706..785H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2009ApJ...706..785H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 3.21305762 d Hartman et al. 2009 (2009ApJ...706..785H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2009): a/R* 11.77; Hartman et al. 2009 (2009ApJ...706..785H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2009): inclination 89 degrees Hartman et al. 2009 (2009ApJ...706..785H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2009): e 0 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2456851.481119 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by hat-p-12's measured color (#ffd1b6, the color dataset of hat-p-12 (src/objects/hat-p-12/source/photometry/stellar-color.json)) at the gray's own brightness.

**Measured day side.** The page opens on the one thing measured of its surface: a dayside brightness temperature of 959 K at 3.6 µm (Deming et al. 2023, dayside brightness temperature at 3.6 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2); [record](source/photometry/dayside-temperature.json)). Chosen by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. The `measured-dayside` format paints the hemisphere under the star in false color at that temperature, on the 300 to 3,000 K scale every measured day side shares, and leaves the night hemisphere blank. It is too cool for a visible glow, so no black-body color is shown.

**Charts.** The orbits of Komondor's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (50, 76, 77), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-12b.json).


## Known problems

- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-12b" (revision 1374169024) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
