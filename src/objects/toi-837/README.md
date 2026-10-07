# TOI-837

## Sources

Its radius and temperature follow Barragán et al. 2024. The introduction is generated from Barragán et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5251470948229949568, parallax 7.011 ± 0.012 mas (142.64 pc). Radius 1.052 +/- 0.012 solar radii from Barragán et al. 2024, the stellar radius of the default parameter set of TOI-837 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.531.4275B/abstract). Mass 1.142 +/- 0.008 solar masses from Barragán et al. 2024, the stellar mass of the default parameter set of TOI-837 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.531.4275B/abstract). Temperature 5,995 K from Barragán et al. 2024, the stellar temperature of the default parameter set of TOI-837 b in the NASA Exoplanet Archive. log g 4.45 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5251470948229949568, through the CIE 1931 2° observer: #fff3f4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,995 K and log g 4.45 (u1 0.416, u2 0.286): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 10, 11, 37, 63, 64 and 90 (the newest of March and April 2025; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 10 gives a period of 3.10 d from the autocorrelation, whose peaks have a height of 0.42, a width of 0.42 and a fit of 0.94; Sector 11 gives a period of 3.14 d from the autocorrelation, whose peaks have a height of 0.34, a width of 0.42 and a fit of 0.93; Sector 37 gives a period of 3.06 d from the autocorrelation, whose peaks have a height of 0.49, a width of 0.47 and a fit of 1.00; Sector 63 gives a period of 3.06 d from the autocorrelation, whose peaks have a height of 0.59, a width of 0.47 and a fit of 1.00; Sector 64 gives a period of 3.02 d from the autocorrelation, whose peaks have a height of 0.61, a width of 0.47 and a fit of 1.00; Sector 90 gives a period of 2.99 d from the autocorrelation, whose peaks have a height of 0.38, a width of 0.44 and a fit of 1.00; 1 more of the star's 7 sectors does not meet the criteria. All 7 together give a period of 2.99 d from the autocorrelation, whose peaks have a height of 0.63, a width of 0.43 and a fit of 0.99, which is the star's period: 2.99 d. The light varies by 2.6% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 2.973 d from the catalogues. The map's light curve leaves a scatter of 0.28% about the light, whose own noise is 0.05%. Gaia DR3 lists 142 other stars within 63 arcseconds, with 23% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 69.8°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of March and April 2025: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
