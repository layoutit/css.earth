# WASP-85 A

## Sources

Its radius and temperature follow Mo&#x10D;nik et al. 2016. The introduction is generated from Mo&#x10D;nik et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3909745223886018432, parallax 7.092 ± 0.018 mas (141.01 pc). Radius 0.935 +/- 0.023 solar radii from Mo&#x10D;nik et al. 2016, the stellar radius of the default parameter set of WASP-85 A b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....151..150M/abstract). Mass 1.09 +/- 0.08 solar masses from Mo&#x10D;nik et al. 2016, the stellar mass of the default parameter set of WASP-85 A b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....151..150M/abstract). Temperature 6,112 K from Mo&#x10D;nik et al. 2016, the stellar temperature of the default parameter set of WASP-85 A b in the NASA Exoplanet Archive. log g 4.53 from the mass and radius.

**Color.** A Planck spectrum at 6,112 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #fff5f4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,112 K and log g 4.53 (u1 0.398, u2 0.295): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 1 (June to August 2014; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is the light curve [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 1 the light varies by 0.67% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give 6.59, 6.75 and 6.75 d, and the periodogram's peak has a height of 0.32: within what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three within a day of each other, a peak over 0.3). The period is their mean, 6.7 d. Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The light repeats every 6.7 d, half the 15.1 d the star's record holds from the catalogues, so the star is taken to turn once in two of them. The map's light curve leaves a scatter of 0.14% about the light, whose own noise is 0.07%. Gaia DR3 lists 1 other star within 16 arcseconds, with 31% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 60.3°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of June to August 2014: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
