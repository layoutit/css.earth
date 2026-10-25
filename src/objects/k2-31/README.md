# K2-31

## Sources

Its radius and temperature follow Grziwa et al. 2016. The introduction is generated from Grziwa et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6050191241556876672, parallax 9.076 ± 0.017 mas (110.18 pc). Radius 0.78 +/- 0.07 solar radii from Grziwa et al. 2016, the stellar radius of the default parameter set of K2-31 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....152..132G/abstract). Mass 0.91 +/- 0.06 solar masses from Grziwa et al. 2016, the stellar mass of the default parameter set of K2-31 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....152..132G/abstract). Temperature 5,280 K from Grziwa et al. 2016, the stellar temperature of the default parameter set of K2-31 b in the NASA Exoplanet Archive. log g 4.61 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6050191241556876672, through the CIE 1931 2° observer: #ffe9da. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,280 K and log g 4.61 (u1 0.579, u2 0.179): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 2 (August to November 2014; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is among the light curves [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) searched for rotation, and the star's row in their table (VizieR J/A+A/635/A43/table2) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** Reinhold & Hekker (2020, A&A 635, A43) ask the periodogram, the wavelet and the autocorrelation of a campaign's light to give periods within a day of each other under 10 days, two days to 20 and five beyond, with a periodogram peak over 0.3, a period between a day and half the light's span, and a variability range under 10%. Their table (VizieR J/A+A/635/A43/table2) gives a rotation period of 17.03 ± 1.41 d in campaign 2, with a periodogram peak of 0.34: the star's period is 17.03 d, as published, and no criteria were applied to it here. The light varies by 0.88% (the range between its 5th and 95th percentiles, as the table prints it (the mean of the campaigns' variability ranges)). Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The criteria of Reinhold & Hekker (2020, A&A 635, A43), applied here to the star's K2 light, are not met: A period of 44.15 d is outside the range Reinhold & Hekker (2020) accept: longer than a day and shorter than half the 77 days of light. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: The autocorrelation of sector 91 gives 10.80 d with peaks of height -0.03, width 3.23 and fit 0.74, outside what Holcomb et al. (2022) accept (a height over a quarter of the width, a width between 0.4 and 0.6, a fit over 0.9). The star's record holds 18.38 d from the catalogues. The map's light curve leaves a scatter of 0.70% about the light, whose own noise is 0.05%. Gaia DR3 lists 2 other stars within 16 arcseconds, with 0.12% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of August to November 2014: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
