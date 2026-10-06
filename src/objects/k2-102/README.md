# K2-102

## Sources

Its radius and temperature follow Mann et al. 2017. The introduction is generated from Mann et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 661310756111835392, parallax 5.396 ± 0.019 mas (185.33 pc). Radius 0.71 +/- 0.03 solar radii from Mann et al. 2017, the stellar radius of the default parameter set of K2-102 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153...64M/abstract). Mass 0.77 +/- 0.06 solar masses from Mann et al. 2017, the stellar mass of the default parameter set of K2-102 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153...64M/abstract). Temperature 4,695 K from Mann et al. 2017, the stellar temperature of the default parameter set of K2-102 b in the NASA Exoplanet Archive. log g 4.62 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 661310756111835392, through the CIE 1931 2° observer: #ffd2b3. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,695 K and log g 4.62 (u1 0.737, u2 0.052): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curves of campaigns 5, 16 and 18 (the newest of May to July 2018; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). They are the light curves [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether each shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** K2 observed the star in campaigns 5, 16 and 18, and the light of each meets what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three methods' periods within a day of each other under 10 days, two days to 20 and five beyond; a periodogram peak over 0.3): campaign 5 gives 11.64, 11.36 and 11.63 d with a peak of 0.76; campaign 16 gives 11.77, 11.57 and 11.75 d with a peak of 0.60; campaign 18 gives 11.34, 11.03 and 11.38 d with a peak of 0.87. The star's period is the mean of the campaigns' 11.54, 11.7 and 11.25 d: 11.5 d, as the paper takes it for a star observed more than once. The light varies by 2.0% (the range between its 5th and 95th percentiles, the mean of the campaigns'). Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The star's record holds 11.5 d from the catalogues. The map's light curve leaves a scatter of 0.20% about the light, whose own noise is 0.06%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 73.8°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of May to July 2018: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
