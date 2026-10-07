# Kepler-1313

## Sources

Its radius and temperature follow Morton et al. 2016. The introduction is generated from Morton et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2125713940547834496, parallax 5.684 ± 0.009 mas (175.92 pc). Radius 0.85 +/- 0.025 solar radii from Morton et al. 2016, the stellar radius of the default parameter set of Kepler-1313 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Mass 0.92 +/- 0.031 solar masses from Morton et al. 2016, the stellar mass of the default parameter set of Kepler-1313 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Temperature 5,453 K from Morton et al. 2016, the stellar temperature of the default parameter set of Kepler-1313 b in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2125713940547834496, through the CIE 1931 2° observer: #ffe8d9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,453 K and log g 4.54 (u1 0.534, u2 0.211): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 40, 41, 55, 75, 81 and 82 (the newest of August and September 2024; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 40 gives a period of 6.20 d from the autocorrelation, whose peaks have a height of 0.30, a width of 0.42 and a fit of 0.97; Sector 41 gives a period of 5.90 d from the autocorrelation, whose peaks have a height of 0.22, a width of 0.51 and a fit of 0.96; Sector 55 gives a period of 6.22 d from the autocorrelation, whose peaks have a height of 0.35, a width of 0.42 and a fit of 0.99; Sector 75 gives a period of 5.96 d from the autocorrelation, whose peaks have a height of 0.28, a width of 0.47 and a fit of 0.99; Sector 81 gives a period of 6.37 d from the autocorrelation, whose peaks have a height of 0.37, a width of 0.43 and a fit of 0.99; Sector 82 gives a period of 6.00 d from the autocorrelation, whose peaks have a height of 0.18, a width of 0.43 and a fit of 0.98; 2 more of the star's 8 sectors do not meet the criteria. All 8 together give a period of 6.22 d from the autocorrelation, whose peaks have a height of 0.35, a width of 0.43 and a fit of 0.99, which is the star's period: 6.22 d. The light varies by 2.1% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 6.14 d from the catalogues. The map's light curve leaves a scatter of 0.36% about the light, whose own noise is 0.07%. Gaia DR3 lists 60 other stars within 63 arcseconds, with 33% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of August and September 2024: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
