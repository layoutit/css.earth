# XO-3 b

## Sources

It is the only planet known around XO-3. Its orbit and size follow Rusznak et al. 2025's fit, the archive's default. The introduction is generated from Rusznak et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 1.32 Jupiter radii from Rusznak et al. 2025 (2025ApJ...983L..42R), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJ...983L..42R/abstract): 94,369.4 km at 71,492 km per Jupiter radius. GM from the mass 13.27 Jupiter masses (Rusznak et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025ApJ...983L..42R), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025ApJ...983L..42R/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): P 3.19152255771 d Rusznak et al. 2025 (2025ApJ...983L..42R), via the NASA Exoplanet Archive ps table (pl_refname RUSZNAK_ET_AL_2025): a/R* 6.797; Rusznak et al. 2025 (2025ApJ...983L..42R), via the NASA Exoplanet Archive ps table (pl_refname RUSZNAK_ET_AL_2025): inclination 83.66 degrees Rusznak et al. 2025 (2025ApJ...983L..42R), via the NASA Exoplanet Archive ps table (pl_refname RUSZNAK_ET_AL_2025): e 0.2791 Rusznak et al. 2025 (2025ApJ...983L..42R), via the NASA Exoplanet Archive ps table (pl_refname RUSZNAK_ET_AL_2025): omega -10.84 degrees, stored as 349.16 Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): transit mid-time 2459936.0976708 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 2,107 K dayside brightness temperature measured in secondary eclipse at 4.5 µm (Deming et al. 2023, dayside brightness temperature at 4.5 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2)): #ff9125. Chosen from the archive's emission rows by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of XO-3's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (59, 73, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/xo-3b.json).


## Known problems

- **Orbit convention.** omega -10.84 degrees is taken as Rusznak et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.2791) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "XO-3b" (revision 1374244998) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
