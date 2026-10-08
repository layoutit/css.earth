# KELT-16 b

## Sources

It is the only planet known around KELT-16. Its orbit and size follow Oberst et al. 2017's fit, the archive's default. The introduction is generated from Oberst et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 1.415 Jupiter radii from Oberst et al. 2017 (2017AJ....153...97O), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153...97O/abstract): 101,161.2 km at 71,492 km per Jupiter radius. GM from the mass 2.75 Jupiter masses (Oberst et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153...97O), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153...97O/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 0.968992962 d Oberst et al. 2017 (2017AJ....153...97O), via the NASA Exoplanet Archive ps table (pl_refname OBERST_ET_AL__2017): a/R* 3.23; Oberst et al. 2017 (2017AJ....153...97O), via the NASA Exoplanet Archive ps table (pl_refname OBERST_ET_AL__2017): inclination 84.4 degrees Oberst et al. 2017 (2017AJ....153...97O), via the NASA Exoplanet Archive ps table (pl_refname OBERST_ET_AL__2017): e 0 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2458392.597691 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 3,273 K dayside brightness temperature measured in secondary eclipse at 4.5 µm (Deming et al. 2023, dayside brightness temperature at 4.5 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2)): #ffc07e. Chosen from the archive's emission rows by rule: 1 measured of 1 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Spitzer heat map.** Bell et al. (2021)'s published fit to a Spitzer IRAC 4.5 µm phase curve (program 14059) ([record](source/science/bell-2021/phase-curve.json)), drawn as a map of longitude without refitting: 1,500 to 3,450 K, hottest 38° west of noon. It has no north-south information.

**Charts.** The orbits of KELT-16's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (15, 41, 55), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-08: the map's record is Bell et al. (2021)'s row of preferred model parameters, read as [WASP-14 b's](../wasp-14b/README.md) is. The paper's night side was not an input: the map gives 1,925 K at mid-transit against the printed 1900 +430/-440 K, and its maximum falls 38° after eclipse, as printed (-38 +16/-15° east).

Generated 2026-10-08 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kelt-16b.json).


## Known problems

- **The map is a fit, not an image.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
