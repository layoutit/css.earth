# WASP-107 b

## Sources

It is one of 2 planets known around WASP-107. Its orbit and size follow Yee & Vissapragada 2026's fit, the archive's default. The introduction is generated from Yee & Vissapragada 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.935 Jupiter radii from Yee & Vissapragada 2026 (2026ApJ..1000L..54Y), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026ApJ..1000L..54Y/abstract): 66,845 km at 71,492 km per Jupiter radius. GM from the mass 0.1039 Jupiter masses (Yee & Vissapragada 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026ApJ..1000L..54Y), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026ApJ..1000L..54Y/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): P 5.7214876 d Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): a/R* 16.5; Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): inclination 89.55 degrees Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): e 0.09 Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): omega 79.3 degrees Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): transit mid-time 2459958.74727 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by wasp-107's measured color (#ffc49e, the color dataset of wasp-107 (src/objects/wasp-107/source/photometry/stellar-color.json)) at the gray's own brightness.

**Measured day side.** The page opens on the one thing measured of its surface: a dayside brightness temperature of 947 K at 3.6 µm (Deming et al. 2023, dayside brightness temperature at 3.6 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2); [record](source/photometry/dayside-temperature.json)). Chosen by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. The `measured-dayside` format paints the hemisphere under the star in false color at that temperature, on the 300 to 3,000 K scale every measured day side shares, and leaves the night hemisphere blank. It is too cool for a visible glow, so no black-body color is shown.

**Charts.** The orbits of WASP-107's planets from above, from their hosted-orbit records, and its transmission spectrum, 49 bins from Spake et al. 2018 in the archive's transitspec table, the most of its 2 papers; its transit in 1 TESS sector (91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-107b.json).

## Known problems

- **Orbit convention.** omega 79.3 degrees is taken as Wu et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.09) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
