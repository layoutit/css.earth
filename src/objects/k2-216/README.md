# K2-216

## Sources

Its radius and temperature follow Persson et al. 2018. The introduction is generated from Persson et al. 2018's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2556231154370582400, parallax 8.688 ± 0.023 mas (115.10 pc); its RUWE is 1.6, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.72 +/- 0.03 solar radii from Persson et al. 2018, the stellar radius of the default parameter set of K2-216 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018A&A...618A..33P/abstract). Mass 0.7 +/- 0.03 solar masses from Persson et al. 2018, the stellar mass of the default parameter set of K2-216 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018A&A...618A..33P/abstract). Temperature 4,503 K from Persson et al. 2018, the stellar temperature of the default parameter set of K2-216 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2556231154370582400, through the CIE 1931 2° observer: #ffceaf. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,503 K and log g 4.57 (u1 0.780, u2 0.016): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 8 (January to March 2016; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is the light curve [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 8 the light varies by 0.36% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give 17.37, 17.03 and 18.75 d, and the periodogram's peak has a height of 0.48: within what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three within two days of each other, a peak over 0.3). The period is their mean, 17.72 d. Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.07% about the light, whose own noise is 0.03%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of January to March 2016: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
