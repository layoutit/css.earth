# Kepler-736

## Sources

Its radius and temperature follow Morton et al. 2016. The introduction is generated from Morton et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2106546978971754368, parallax 0.987 ± 0.024 mas (1013.15 pc). Radius 0.81 +/- 0.047 solar radii from Morton et al. 2016, the stellar radius of the default parameter set of Kepler-736 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Mass 0.86 +/- 0.041 solar masses from Morton et al. 2016, the stellar mass of the default parameter set of Kepler-736 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Temperature 5,217 K from Morton et al. 2016, the stellar temperature of the default parameter set of Kepler-736 b in the NASA Exoplanet Archive. log g 4.56 from the mass and radius.

**Color.** A Planck spectrum at 5,217 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe9d7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,217 K and log g 4.56 (u1 0.596, u2 0.167): a model, because no fit of this star's limb is used.

**Brightness from Kepler.** The Color + brightness and Brightness map datasets are made in this project from quarters 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 14 and 15 of the star's KEPSEISMIC light curve (the newest of October 2012 to January 2013), which its authors make from the Kepler mission's pixels and keep at [MAST](https://archive.stsci.edu/hlsp/kepseismic) ([source record](../../sources/mast-kepseismic-light-curves.json)). It is the light curve [Santos et al. (2019, ApJS 244, 21)](https://arxiv.org/abs/1908.05222) judge, and the star's row in their table (VizieR J/ApJS/244/21, table 3) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from Kepler.** Santos et al. (2019, ApJS 244, 21) ask the wavelet, the autocorrelation and their product to give one period in the star's light filtered at 20, 55 and 80 days, selected by the paper's automatic criteria or by its authors' inspection. Their table (VizieR J/ApJS/244/21, table 3) gives a rotation period of 33.05 ± 2.72 d and a photometric activity (S_ph, the scatter of the light over five rotations) of 550 parts per million: the star's period is 33.05 d, as published, and no criteria were applied to it here. The light varies by 0.33% (the range between its 5th and 95th percentiles, measured here over the quarters mapped; the table prints another measure of it, S_ph). The papers read a period of 33.05 d in the star's light filtered at 55 days, and that is the light curve mapped. 4 of the star's 17 quarters have no map. The papers' rule on a quarter's variance (García et al. 2014) removes quarters 5, 13 and 16, whose variance is 2.2, 3.15 and 2.87 times the median of the star's quarters. Quarter 17 holds less than one turn of the star. For the 11,209 stars also in McQuillan et al. (2013, 2014), the paper's periods agree with theirs within two sigma for 99.4%. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 3 sectors, and Holcomb et al. (2022) ask for at least 2. The star's record holds 33.05 d from the catalogues. The map's light curve leaves a scatter of 0.09% about the light, whose own noise is 0.06%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from Kepler.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of October 2012 to January 2013: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
