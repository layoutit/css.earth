# K2-370

## Sources

Its radius and temperature follow Sozzetti et al. 2024. It is also HD 284521. The introduction is generated from Sozzetti et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 144150720342734208, parallax 7.096 ± 0.020 mas (140.93 pc). Radius 0.945 +/- 0.008 solar radii from Sozzetti et al. 2024, the stellar radius of the default parameter set of K2-370 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.535..531S/abstract). Mass 0.962 +/- 0.035 solar masses from Sozzetti et al. 2024, the stellar mass of the default parameter set of K2-370 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.535..531S/abstract). Temperature 5,662 K from Sozzetti et al. 2024, the stellar temperature of the default parameter set of K2-370 b in the NASA Exoplanet Archive. log g 4.47 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 144150720342734208, through the CIE 1931 2° observer: #ffebde. Routes tried in order: stis-ngsl: HD 284521 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,662 K and log g 4.47 (u1 0.484, u2 0.244): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 13 (March to May 2017; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is the light curve [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 13 the light varies by 2.7% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give 13.29, 13.07 and 13.50 d, and the periodogram's peak has a height of 0.57: within what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three within two days of each other, a peak over 0.3). The period is their mean, 13.29 d. Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The star's record holds 13.55 d from the catalogues. The map's light curve leaves a scatter of 0.29% about the light, whose own noise is 0.08%. Gaia DR3 lists 1 other star within 16 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 69.3°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of March to May 2017: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
