# K2-121

## Sources

Its radius and temperature follow Howard et al. 2025. The introduction is generated from Howard et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 662078902422542336, parallax 5.907 ± 0.018 mas (169.29 pc). Radius 0.675 +/- 0.033 solar radii from Howard et al. 2025, the stellar radius of the default parameter set of K2-121 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract). Mass 0.71 +/- 0.03 solar masses from Howard et al. 2025, the stellar mass of the default parameter set of K2-121 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract). Temperature 4,526 K from Howard et al. 2025, the stellar temperature of the default parameter set of K2-121 b in the NASA Exoplanet Archive. log g 4.63 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 662078902422542336, through the CIE 1931 2° observer: #ffcfb0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,526 K and log g 4.63 (u1 0.770, u2 0.024): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curves of campaigns 5 and 18 (the newest of May to July 2018; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). They are the light curves [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether each shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** K2 observed the star in campaigns 5 and 18, and the light of each meets what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three methods' periods within a day of each other under 10 days, two days to 20 and five beyond; a periodogram peak over 0.3): campaign 5 gives 10.36, 10.16 and 10.63 d with a peak of 0.73; campaign 18 gives 10.38, 10.25 and 10.50 d with a peak of 0.61. The star's period is the mean of the campaigns' 10.38 and 10.38 d: 10.38 d, as the paper takes it for a star observed more than once. The light varies by 1.6% (the range between its 5th and 95th percentiles, the mean of the campaigns'). Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.24% about the light, whose own noise is 0.15%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of May to July 2018: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
