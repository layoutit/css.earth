# K2-90

## Sources

Its radius and temperature follow Dressing et al. 2017. The introduction is generated from Dressing et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 65331198513957376, parallax 7.445 ± 0.014 mas (134.31 pc). Radius 0.634754 +/- 0.029302 solar radii from Dressing et al. 2017, the stellar radius of the default parameter set of K2-90 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....154..207D/abstract). Mass 0.704613 +/- 0.070461 solar masses from Dressing et al. 2017, the stellar mass of the default parameter set of K2-90 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....154..207D/abstract). Temperature 4,421.98 K from Dressing et al. 2017, the stellar temperature of the default parameter set of K2-90 c in the NASA Exoplanet Archive. log g 4.68 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 65331198513957376, through the CIE 1931 2° observer: #ffbe93. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,421.98 K and log g 4.68 (u1 0.755, u2 0.037): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 4 (February to April 2015; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is among the light curves [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) searched for rotation, and the star's row in their table (VizieR J/A+A/635/A43/table2) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** Reinhold & Hekker (2020, A&A 635, A43) ask the periodogram, the wavelet and the autocorrelation of a campaign's light to give periods within a day of each other under 10 days, two days to 20 and five beyond, with a periodogram peak over 0.3, a period between a day and half the light's span, and a variability range under 10%. Their table (VizieR J/A+A/635/A43/table2) gives a rotation period of 25.21 ± 3.86 d in campaign 4, with a periodogram peak of 0.3: the star's period is 25.21 d, as published, and no criteria were applied to it here. The light varies by 0.21% (the range between its 5th and 95th percentiles, as the table prints it (the mean of the campaigns' variability ranges)). Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The criteria of Reinhold & Hekker (2020, A&A 635, A43), applied here to the star's K2 light, are not met: The periodogram's highest peak, at 23.35 d, has a height of 0.24, not over the 0.3 that Reinhold & Hekker (2020) ask of a rotation. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 4 sectors, and Holcomb et al. (2022) ask for at least 2. The star's record holds 25.21 d from the catalogues. The map's light curve leaves a scatter of 0.05% about the light, whose own noise is 0.03%. Gaia DR3 lists 1 other star within 16 arcseconds, with 6.4% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of February to April 2015: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
