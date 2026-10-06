# K2-198

## Sources

Its radius and temperature follow Hedges et al. 2019. The introduction is generated from Hedges et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3628687065162340224, parallax 8.966 ± 0.027 mas (111.53 pc); its RUWE is 1.4, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.757 +/- 0.035 solar radii from Hedges et al. 2019, the stellar radius of the default parameter set of K2-198 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019ApJ...880L...5H/abstract). Mass 0.799 +/- 0.091 solar masses from Hedges et al. 2019, the stellar mass of the default parameter set of K2-198 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019ApJ...880L...5H/abstract). Temperature 5,212.9 K from Hedges et al. 2019, the stellar temperature of the default parameter set of K2-198 c in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3628687065162340224, through the CIE 1931 2° observer: #ffe6d5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,212.9 K and log g 4.58 (u1 0.597, u2 0.166): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curves of campaigns 6 and 17 (the newest of March to May 2018; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). They are the light curves [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether each shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** K2 observed the star in campaigns 6 and 17, and the light of each meets what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three methods' periods within a day of each other under 10 days, two days to 20 and five beyond; a periodogram peak over 0.3): campaign 6 gives 7.01, 6.93 and 7.13 d with a peak of 0.72; campaign 17 gives 7.10, 6.97 and 7.13 d with a peak of 0.82. The star's period is the mean of the campaigns' 7.02 and 7.06 d: 7.04 d, as the paper takes it for a star observed more than once. The light varies by 2.4% (the range between its 5th and 95th percentiles, the mean of the campaigns'). Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The star's record holds 7.18 d from the catalogues. The map's light curve leaves a scatter of 0.27% about the light, whose own noise is 0.07%. Gaia DR3 lists 1 other star within 16 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of March to May 2018: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
