# TOI-251

## Sources

Its radius and temperature follow Zhou et al. 2021. The introduction is generated from Zhou et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6539037542941988736, parallax 9.901 ± 0.014 mas (101.00 pc). Radius 0.881 +/- 0.038 solar radii from Zhou et al. 2021, the stellar radius of the default parameter set of TOI-251 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161....2Z/abstract). Mass 1.036 +/- 0.013 solar masses from Zhou et al. 2021, the stellar mass of the default parameter set of TOI-251 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161....2Z/abstract). Temperature 5,875 K from Zhou et al. 2021, the stellar temperature of the default parameter set of TOI-251 b in the NASA Exoplanet Archive. log g 4.56 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6539037542941988736, through the CIE 1931 2° observer: #fff3f3. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,875 K and log g 4.56 (u1 0.440, u2 0.271): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 2, 29, 69, 96 and 106 (the newest of July and August 2026; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 2 gives a period of 3.88 d from the autocorrelation, whose peaks have a height of 0.42, a width of 0.48 and a fit of 1.00; Sector 29 gives a period of 3.87 d from the autocorrelation, whose peaks have a height of 0.41, a width of 0.45 and a fit of 1.00; Sector 69 gives a period of 3.87 d from the autocorrelation, whose peaks have a height of 0.25, a width of 0.43 and a fit of 1.00; Sector 96 gives a period of 3.85 d from the autocorrelation, whose peaks have a height of 0.36, a width of 0.46 and a fit of 1.00; Sector 106 gives a period of 3.88 d from the autocorrelation, whose peaks have a height of 0.31, a width of 0.49 and a fit of 0.99. All 5 together give a period of 3.86 d from the autocorrelation, whose peaks have a height of 0.38, a width of 0.46 and a fit of 1.00, which is the star's period: 3.86 d. The light varies by 2.4% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 3.84 d from the catalogues. The map's light curve leaves a scatter of 0.25% about the light, whose own noise is 0.04%. Gaia DR3 lists 1 other star within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 82.2°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of July and August 2026: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
