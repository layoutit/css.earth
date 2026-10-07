# Kepler-1656

## Sources

Its radius follows Angelo et al. 2022, and its temperature TICv8. The introduction is generated from Angelo et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2103392720630278656, parallax 5.317 ± 0.010 mas (188.06 pc). Radius 1.1 +/- 0.13 solar radii from Angelo et al. 2022, the stellar radius of the default parameter set of Kepler-1656 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..227A/abstract). Mass 1.03 +/- 0.04 solar masses from Angelo et al. 2022, the stellar mass of the default parameter set of Kepler-1656 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..227A/abstract). Temperature 5,696 K from TICv8, the stellar temperature of Kepler-1656 b's parameter set from TICv8 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2103392720630278656, through the CIE 1931 2° observer: #fff0eb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,696 K and log g 4.37 (u1 0.475, u2 0.250): a model, because no fit of this star's limb is used.

**Brightness from Kepler.** The Color + brightness and Brightness map datasets are made in this project from quarters 1, 2, 4, 6, 8, 10, 11, 12 and 15 of the star's KEPSEISMIC light curve (the newest of October 2012 to January 2013), which its authors make from the Kepler mission's pixels and keep at [MAST](https://archive.stsci.edu/hlsp/kepseismic) ([source record](../../sources/mast-kepseismic-light-curves.json)). It is the light curve [Santos et al. (2021, ApJS 255, 17)](https://arxiv.org/abs/2107.02217) judge, and the star's row in their table (VizieR J/ApJS/255/17, table 1) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from Kepler.** Santos et al. (2021, ApJS 255, 17) ask the wavelet, the autocorrelation and their product to give one period in the star's light filtered at 20, 55 and 80 days, selected by the paper's random forest (ROOSTER), by its automatic criteria or by its authors' inspection. Their table (VizieR J/ApJS/255/17, table 1) gives a rotation period of 18.62 ± 3.48 d and a photometric activity (S_ph, the scatter of the light over five rotations) of 254 parts per million: the star's period is 18.62 d, as published, and no criteria were applied to it here. The light varies by 0.10% (the range between its 5th and 95th percentiles, measured here over the quarters mapped; the table prints another measure of it, S_ph). The papers read a period of 18.62 d in the star's light filtered at 20 days, and that is the light curve mapped. 5 of the star's 14 quarters have no map. The papers' rule on a quarter's variance (García et al. 2014) removes quarters 3, 7, 14 and 16, whose variance is 2.13, 1.5, 3.39 and 2.88 times the median of the star's quarters. Quarter 0 holds less than one turn of the star. For the 20,080 stars also in McQuillan et al. (2014), the paper's periods agree with theirs within 15% for 99.1%. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 7 sectors, and Holcomb et al. (2022) ask for at least 4. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.03% about the light, whose own noise is 0.01%. Gaia DR3 lists 1 other star within 16 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-1656 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

- **Brightness from Kepler.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of October 2012 to January 2013: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
