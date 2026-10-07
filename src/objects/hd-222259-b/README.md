# HD 222259B

## Sources

HD 222259B shares its motion through space with DS Tuc A, 237 AU away, so the two are a bound pair. Both are placed where Gaia measures them. The introduction is generated from El-Badry, Rix & Heintz (2021), MNRAS 506, 2269's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6387058411482257280, parallax 22.652 ± 0.013 mas (44.15 pc). Radius 0.848 +/- 0.063 solar radii from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the radius of TIC 410214984 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Mass 0.74 +/- 0.089 solar masses from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the mass of TIC 410214984 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Temperature 4,658 K from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the effective temperature of TIC 410214984 (VizieR IV/39/tic82). log g 4.45 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6387058411482257280, through the CIE 1931 2° observer: #ffd8be. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,658 K and log g 4.45 (u1 0.749, u2 0.044): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 1, 27, 28, 67, 68, 102, 103 and 104 (the newest of May and June 2026; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 1 gives a period of 2.93 d from the autocorrelation, whose peaks have a height of 0.42, a width of 0.46 and a fit of 1.00; Sector 27 gives a period of 3.73 d from the autocorrelation, whose peaks have a height of 0.30, a width of 0.56 and a fit of 0.99; Sector 28 gives a period of 3.61 d from the autocorrelation, whose peaks have a height of 0.35, a width of 0.50 and a fit of 1.00; Sector 67 gives a period of 2.99 d from the autocorrelation, whose peaks have a height of 0.24, a width of 0.51 and a fit of 0.99; Sector 68 gives a period of 3.00 d from the autocorrelation, whose peaks have a height of 0.34, a width of 0.46 and a fit of 0.99; Sector 102 gives a period of 2.88 d from the autocorrelation, whose peaks have a height of 0.41, a width of 0.44 and a fit of 0.99; Sector 103 gives a period of 2.86 d from the autocorrelation, whose peaks have a height of 0.34, a width of 0.43 and a fit of 0.99; Sector 104 gives a period of 3.49 d from the autocorrelation, whose peaks have a height of 0.27, a width of 0.52 and a fit of 0.97. All 8 together give a period of 2.85 d from the autocorrelation, whose peaks have a height of 0.35, a width of 0.45 and a fit of 0.99, which is the star's period: 2.85 d. The light varies by 13% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 2.85 d from the catalogues. The map's light curve leaves a scatter of 3.1% about the light, whose own noise is 0.35%. Gaia DR3 lists 7 other stars within 63 arcseconds, with 69% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** HD 222259B's orbit around DS Tuc A is not measured; both stars are placed at their Gaia DR3 positions, which is where they are.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of May and June 2026: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
