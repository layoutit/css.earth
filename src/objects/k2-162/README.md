# K2-162

## Sources

Its radius and temperature follow Livingston et al. 2018. The introduction is generated from Livingston et al. 2018's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3694878833385971840, parallax 8.006 ± 0.016 mas (124.90 pc). Radius 0.69 +/- 0.01 solar radii from Livingston et al. 2018, the stellar radius of the default parameter set of K2-162 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156...78L/abstract). Mass 0.75 +/- 0.02 solar masses from Livingston et al. 2018, the stellar mass of the default parameter set of K2-162 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156...78L/abstract). Temperature 4,842 K from Livingston et al. 2018, the stellar temperature of the default parameter set of K2-162 b in the NASA Exoplanet Archive. log g 4.64 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3694878833385971840, through the CIE 1931 2° observer: #ffd6bd. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,842 K and log g 4.64 (u1 0.701, u2 0.083): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 102 (July to September 2016; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is among the light curves [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) searched for rotation, and the star's row in their table (VizieR J/A+A/635/A43/table2) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** Reinhold & Hekker (2020, A&A 635, A43) ask the periodogram, the wavelet and the autocorrelation of a campaign's light to give periods within a day of each other under 10 days, two days to 20 and five beyond, with a periodogram peak over 0.3, a period between a day and half the light's span, and a variability range under 10%. Their table (VizieR J/A+A/635/A43/table2) gives a rotation period of 14.97 ± 1.1 d in campaign 10, with a periodogram peak of 0.67: the star's period is 14.97 d, as published, and no criteria were applied to it here. The light varies by 0.38% (the range between its 5th and 95th percentiles, as the table prints it (the mean of the campaigns' variability ranges)). Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The criteria of Reinhold & Hekker (2020, A&A 635, A43), applied here to the star's K2 light, are not met: The periodogram's highest peak, at 15.08 d, has a height of 0.14, not over the 0.3 that Reinhold & Hekker (2020) ask of a rotation. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 2 sectors, and Holcomb et al. (2022) ask for at least 1. The star's record holds 14.5576 d from the catalogues. The map's light curve leaves a scatter of 0.21% about the light, whose own noise is 0.16%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of July to September 2016: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
