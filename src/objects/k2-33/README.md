# K2-33

## Sources

Its radius and temperature follow Mann et al. 2016. The introduction is generated from Mann et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6245758900889486720, parallax 7.193 ± 0.023 mas (139.03 pc). Radius 1.05 +/- 0.07 solar radii from Mann et al. 2016, the stellar radius of the default parameter set of K2-33 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....152...61M/abstract). Mass 0.56 +/- 0.09 solar masses from Mann et al. 2016, the stellar mass of the default parameter set of K2-33 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....152...61M/abstract). Temperature 3,540 K from Mann et al. 2016, the stellar temperature of the default parameter set of K2-33 b in the NASA Exoplanet Archive. log g 4.14 from the mass and radius.

**Color.** A Planck spectrum at 3,540 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc88d. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,540 K and log g 4.14 (u1 0.540, u2 0.258): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 2 (August to November 2014; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is among the light curves [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) searched for rotation, and the star's row in their table (VizieR J/A+A/635/A43/table2) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** Reinhold & Hekker (2020, A&A 635, A43) ask the periodogram, the wavelet and the autocorrelation of a campaign's light to give periods within a day of each other under 10 days, two days to 20 and five beyond, with a periodogram peak over 0.3, a period between a day and half the light's span, and a variability range under 10%. Their table (VizieR J/A+A/635/A43/table2) gives a rotation period of 6.25 ± 0.38 d in campaign 2, with a periodogram peak of 0.77: the star's period is 6.25 d, as published, and no criteria were applied to it here. The light varies by 2.5% (the range between its 5th and 95th percentiles, as the table prints it (the mean of the campaigns' variability ranges)). Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: The autocorrelation of sector 91 gives 12.99 d with peaks of height 0.12, width 0.40 and fit 0.86, outside what Holcomb et al. (2022) accept (a height over a quarter of the width, a width between 0.4 and 0.6, a fit over 0.9). The star's record holds 6.29 d from the catalogues. The map's light curve leaves a scatter of 0.32% about the light, whose own noise is 0.14%. Gaia DR3 lists 1 other star within 16 arcseconds, with 0.31% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "K2-33" (revision 1366881676) verbatim, CC BY-SA 4.0.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 76.2°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of August to November 2014: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
