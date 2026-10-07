# HIP 94235

## Sources

Its radius and temperature follow Zhou et al. 2022. It is also HD 178085. The introduction is generated from Zhou et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6632318361397624960, parallax 17.081 ± 0.021 mas (58.55 pc). Radius 1.08 +/- 0.11 solar radii from Zhou et al. 2022, the stellar radius of the default parameter set of HIP 94235 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..289Z/abstract). Mass 1.094 +/- 0.024 solar masses from Zhou et al. 2022, the stellar mass of the default parameter set of HIP 94235 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..289Z/abstract). Temperature 5,991 K from Zhou et al. 2022, the stellar temperature of the default parameter set of HIP 94235 b in the NASA Exoplanet Archive. log g 4.41 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6632318361397624960, through the CIE 1931 2° observer: #fff6fc. Routes tried in order: stis-ngsl: HD 178085 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,991 K and log g 4.41 (u1 0.416, u2 0.285): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 27, 67, 93, 94, 101, 103 and 104 (the newest of May and June 2026; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 27 gives a period of 2.34 d from the autocorrelation, whose peaks have a height of 0.44, a width of 0.47 and a fit of 0.98; Sector 67 gives a period of 2.31 d from the autocorrelation, whose peaks have a height of 0.46, a width of 0.46 and a fit of 0.99; Sector 93 gives a period of 2.27 d from the autocorrelation, whose peaks have a height of 0.54, a width of 0.47 and a fit of 1.00; Sector 94 gives a period of 2.31 d from the autocorrelation, whose peaks have a height of 0.56, a width of 0.48 and a fit of 1.00; Sector 101 gives a period of 2.31 d from the autocorrelation, whose peaks have a height of 0.55, a width of 0.47 and a fit of 1.00; Sector 103 gives a period of 2.28 d from the autocorrelation, whose peaks have a height of 0.58, a width of 0.48 and a fit of 1.00; Sector 104 gives a period of 2.29 d from the autocorrelation, whose peaks have a height of 0.43, a width of 0.46 and a fit of 1.00. All 7 together give a period of 2.28 d from the autocorrelation, whose peaks have a height of 0.57, a width of 0.48 and a fit of 1.00, which is the star's period: 2.28 d. The light varies by 3.3% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 2.24 d from the catalogues. The map's light curve leaves a scatter of 0.53% about the light, whose own noise is 0.05%. Gaia DR3 lists 27 other stars within 63 arcseconds, with 0.27% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of May and June 2026: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
