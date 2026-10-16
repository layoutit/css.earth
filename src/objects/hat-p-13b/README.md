# HAT-P-13 b

## Sources

It is one of 2 planets known around HAT-P-13. Its orbit and size follow Winn et al. 2010's fit, the archive's default. The introduction is generated from Winn et al. 2010's published values; the sections below are the data's own.

**Size and mass.** Radius 1.272 Jupiter radii from Winn et al. 2010 (2010ApJ...718..575W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2010ApJ...718..575W/abstract): 90,937.8 km at 71,492 km per Jupiter radius. GM from the mass 0.851 Jupiter masses (Winn et al. 2010, the mass the NASA Exoplanet Archive's composite table adopts (2010ApJ...718..575W), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2010ApJ...718..575W/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): P 2.91624121 d Winn et al. 2010 (2010ApJ...718..575W), via the NASA Exoplanet Archive ps table (pl_refname WINN_ET_AL__2010): a/R* 5.8928; Winn et al. 2010 (2010ApJ...718..575W), via the NASA Exoplanet Archive ps table (pl_refname WINN_ET_AL__2010): inclination 83.4 degrees Winn et al. 2010 (2010ApJ...718..575W), via the NASA Exoplanet Archive ps table (pl_refname WINN_ET_AL__2010): e 0.0133 Winn et al. 2010 (2010ApJ...718..575W), via the NASA Exoplanet Archive ps table (pl_refname WINN_ET_AL__2010): omega 210 degrees Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): transit mid-time 2456316.79044 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,732 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Hardy et al. 2017, dayside brightness temperature at 3.6 µm (NASA Exoplanet Archive emission table)): #ff7b00. Chosen from the archive's emission rows by rule: 2 measured of 4 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of HAT-P-13's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (47), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-13b.json).


## Known problems

- **Orbit convention.** omega 210 degrees is taken as Winn et al. 2010 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0133) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-13b" (revision 1154745236) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
