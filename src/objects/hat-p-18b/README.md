# HAT-P-18 b

## Sources

It is the only planet known around HAT-P-18. Its orbit and size follow Yee & Vissapragada 2026's fit, the archive's default. The introduction is generated from Yee & Vissapragada 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.955 Jupiter radii from Yee & Vissapragada 2026 (2026ApJ..1000L..54Y), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026ApJ..1000L..54Y/abstract): 68,274.9 km at 71,492 km per Jupiter radius. GM from the mass 0.1747 Jupiter masses (Yee & Vissapragada 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026ApJ..1000L..54Y), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026ApJ..1000L..54Y/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hewitt et al. 2026 (2026JAVSO..54...39H), via the NASA Exoplanet Archive ps table (pl_refname HEWITT_ET_AL_2026): P 5.50802957 d Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): a/R* 16.39; Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): inclination 88.53 degrees Knutson et al. 2014 (2014ApJ...785..126K), via the NASA Exoplanet Archive ps table (pl_refname KNUTSON_ET_AL__2014): e 0.106 Knutson et al. 2014 (2014ApJ...785..126K), via the NASA Exoplanet Archive ps table (pl_refname KNUTSON_ET_AL__2014): omega 12 degrees Hewitt et al. 2026 (2026JAVSO..54...39H), via the NASA Exoplanet Archive ps table (pl_refname HEWITT_ET_AL_2026): transit mid-time 2459743.8534 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by hat-p-18's measured color (#ffd6ba, the color dataset of hat-p-18 (src/objects/hat-p-18/source/photometry/stellar-color.json)) at the gray's own brightness.

**Measured day side.** The page opens on the one thing measured of its surface: a dayside brightness temperature of 803 K at 4.5 µm (Deming et al. 2023, dayside brightness temperature at 4.5 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2); [record](source/photometry/dayside-temperature.json)). Chosen by rule: 1 measured of 1 rows; the smallest relative uncertainty, then the longest wavelength. The `measured-dayside` format paints the hemisphere under the star in false color at that temperature, on the 300 to 3,000 K scale every measured day side shares, and leaves the night hemisphere blank. It is too cool for a visible glow, so no black-body color is shown.

**Charts.** The orbits of HAT-P-18's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (25, 26, 79), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-18b.json).

## Known problems

- **Orbit convention.** omega 12 degrees is taken as Knutson et al. 2014 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.106) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
