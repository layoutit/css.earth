# Kepler-63

## Sources

Its radius and temperature follow Sanchis-Ojeda et al. 2013. The introduction is generated from Sanchis-Ojeda et al. 2013's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2132628489996257920, parallax 5.116 ± 0.010 mas (195.48 pc). Radius 0.901 +/- 0.027 solar radii from Sanchis-Ojeda et al. 2013, the stellar radius of the default parameter set of Kepler-63 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013ApJ...775...54S/abstract). Mass 0.984 +/- 0.035 solar masses from Sanchis-Ojeda et al. 2013, the stellar mass of the default parameter set of Kepler-63 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013ApJ...775...54S/abstract). Temperature 5,576 K from Sanchis-Ojeda et al. 2013, the stellar temperature of the default parameter set of Kepler-63 b in the NASA Exoplanet Archive. log g 4.52 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2132628489996257920, through the CIE 1931 2° observer: #ffede4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,576 K and log g 4.52 (u1 0.504, u2 0.231): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 14, 41, 54, 55, 74, 80 and 81 (the newest of July and August 2024; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 14 gives a period of 5.50 d from the autocorrelation, whose peaks have a height of 0.43, a width of 0.47 and a fit of 1.00; Sector 41 gives a period of 5.43 d from the autocorrelation, whose peaks have a height of 0.37, a width of 0.46 and a fit of 1.00; Sector 54 gives a period of 5.67 d from the autocorrelation, whose peaks have a height of 0.29, a width of 0.46 and a fit of 0.98; Sector 55 gives a period of 5.47 d from the autocorrelation, whose peaks have a height of 0.40, a width of 0.47 and a fit of 1.00; Sector 74 gives a period of 5.54 d from the autocorrelation, whose peaks have a height of 0.20, a width of 0.48 and a fit of 0.98; Sector 80 gives a period of 5.34 d from the autocorrelation, whose peaks have a height of 0.23, a width of 0.42 and a fit of 0.97; Sector 81 gives a period of 5.63 d from the autocorrelation, whose peaks have a height of 0.31, a width of 0.47 and a fit of 0.98; 4 more of the star's 11 sectors do not meet the criteria. All 11 together give a period of 5.51 d from the autocorrelation, whose peaks have a height of 0.43, a width of 0.45 and a fit of 1.00, which is the star's period: 5.51 d. The light varies by 1.5% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 5.401 d from the catalogues. The map's light curve leaves a scatter of 0.18% about the light, whose own noise is 0.05%. Gaia DR3 lists 22 other stars within 63 arcseconds, with 6.7% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-63" (revision 1374405156) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 41.6°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of July and August 2024: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
