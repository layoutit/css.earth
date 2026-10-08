# Kepler-538

## Sources

Its radius and temperature follow Bonomo et al. 2023. The introduction is generated from Bonomo et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2087171453788422528, parallax 6.426 ± 0.012 mas (155.62 pc). Radius 0.8717 +/- 0.0064 solar radii from Bonomo et al. 2023, the stellar radius of the default parameter set of Kepler-538 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Mass 0.892 +/- 0.051 solar masses from Bonomo et al. 2023, the stellar mass of the default parameter set of Kepler-538 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Temperature 5,534 K from Bonomo et al. 2023, the stellar temperature of the default parameter set of Kepler-538 b in the NASA Exoplanet Archive. log g 4.51 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2087171453788422528, through the CIE 1931 2° observer: #ffefe7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,534 K and log g 4.51 (u1 0.514, u2 0.225): a model, because no fit of this star's limb is used.

**Brightness from Kepler.** The Color + brightness and Brightness map datasets are made in this project from quarters 1, 2, 3, 4, 5, 7, 8, 9, 11, 13, 14, 15, 16 and 17 of the star's KEPSEISMIC light curve (the newest of April and May 2013), which its authors make from the Kepler mission's pixels and keep at [MAST](https://archive.stsci.edu/hlsp/kepseismic) ([source record](../../sources/mast-kepseismic-light-curves.json)). It is the light curve [Santos et al. (2021, ApJS 255, 17)](https://arxiv.org/abs/2107.02217) judge, and the star's row in their table (VizieR J/ApJS/255/17, table 1) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from Kepler.** Santos et al. (2021, ApJS 255, 17) ask the wavelet, the autocorrelation and their product to give one period in the star's light filtered at 20, 55 and 80 days, selected by the paper's random forest (ROOSTER), by its automatic criteria or by its authors' inspection. Their table (VizieR J/ApJS/255/17, table 1) gives a rotation period of 24.1 ± 4.58 d and a photometric activity (S_ph, the scatter of the light over five rotations) of 314 parts per million: the star's period is 24.1 d, as published, and no criteria were applied to it here. The light varies by 0.13% (the range between its 5th and 95th percentiles, measured here over the quarters mapped; the table prints another measure of it, S_ph). The papers read a period of 24.1 d in the star's light filtered at 55 days, and that is the light curve mapped. 4 of the star's 18 quarters have no map. The papers' rule on a quarter's variance (García et al. 2014) removes quarters 6, 10 and 12, whose variance is 1.19, 4.92 and 5.5 times the median of the star's quarters. Quarter 0 holds less than one turn of the star. For the 20,080 stars also in McQuillan et al. (2014), the paper's periods agree with theirs within 15% for 99.1%. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 10 sectors, and Holcomb et al. (2022) ask for at least 5. The star's record holds 25.2 d from the catalogues. The map's light curve leaves a scatter of 0.02% about the light, whose own noise is 0.01%. Gaia DR3 lists 4 other stars within 16 arcseconds, with 0.56% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from Kepler.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 38.9°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of April and May 2013: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
