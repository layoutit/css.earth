# K2-29

## Sources

Its radius and temperature follow Santerne et al. 2016. The introduction is generated from Santerne et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 150054788545735424, parallax 5.643 ± 0.019 mas (177.20 pc). Radius 0.86 +/- 0.01 solar radii from Santerne et al. 2016, the stellar radius of the default parameter set of K2-29 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...824...55S/abstract). Mass 0.94 +/- 0.02 solar masses from Santerne et al. 2016, the stellar mass of the default parameter set of K2-29 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...824...55S/abstract). Temperature 5,358 K from Santerne et al. 2016, the stellar temperature of the default parameter set of K2-29 b in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 150054788545735424, through the CIE 1931 2° observer: #ffdcbc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,358 K and log g 4.54 (u1 0.558, u2 0.194): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 4 (February to April 2015; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is the light curve [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 4 the light varies by 1.5% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give 5.37, 5.28 and 5.38 d, and the periodogram's peak has a height of 0.45: within what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three within a day of each other, a peak over 0.3). The period is their mean, 5.34 d. Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The light repeats every 5.34 d, half the 10.79 d the star's record holds from the catalogues, so the star is taken to turn once in two of them. The map's light curve leaves a scatter of 0.27% about the light, whose own noise is 0.15%. Gaia DR3 lists 2 other stars within 16 arcseconds, with 19% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 66.6°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of February to April 2015: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
