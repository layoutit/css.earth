# K2-25

## Sources

Its radius and temperature follow Stefansson et al. 2020. The introduction is generated from Stefansson et al. 2020's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3311804515502788352, parallax 22.357 ± 0.031 mas (44.73 pc). Radius 0.2932 +/- 0.0093 solar radii from Stefansson et al. 2020, the stellar radius of the default parameter set of K2-25 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..192S/abstract). Mass 0.2634 +/- 0.0077 solar masses from Stefansson et al. 2020, the stellar mass of the default parameter set of K2-25 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..192S/abstract). Temperature 3,207 K from Stefansson et al. 2020, the stellar temperature of the default parameter set of K2-25 b in the NASA Exoplanet Archive. log g 4.92 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3311804515502788352, through the CIE 1931 2° observer: #ffcd83. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,207 K and log g 4.92 (u1 0.155, u2 0.475): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 44, 70 and 71 (the newest of October and November 2023; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 44 gives a period of 1.93 d from the autocorrelation, whose peaks have a height of 0.52, a width of 0.47 and a fit of 1.00; Sector 70 gives a period of 1.91 d from the autocorrelation, whose peaks have a height of 0.44, a width of 0.47 and a fit of 1.00; Sector 71 gives a period of 1.90 d from the autocorrelation, whose peaks have a height of 0.49, a width of 0.47 and a fit of 1.00. All 3 together give a period of 1.90 d from the autocorrelation, whose peaks have a height of 0.52, a width of 0.47 and a fit of 1.00, which is the star's period: 1.9 d. The light varies by 2.2% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 1.878 d from the catalogues. The map's light curve leaves a scatter of 0.32% about the light, whose own noise is 0.21%. Gaia DR3 lists 6 other stars within 63 arcseconds, with 9.8% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "K2-25" (revision 1370531720) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of October and November 2023: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
