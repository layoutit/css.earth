# Kepler-37

## Sources

Its radius and temperature follow Bonomo et al. 2023. The introduction is generated from Bonomo et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2106674071344722688, parallax 15.625 ± 0.010 mas (64.00 pc). Radius 0.789 +/- 0.0064 solar radii from Bonomo et al. 2023, the stellar radius of the default parameter set of Kepler-37 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Mass 0.79 +/- 0.033 solar masses from Bonomo et al. 2023, the stellar mass of the default parameter set of Kepler-37 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Temperature 5,357 K from Bonomo et al. 2023, the stellar temperature of the default parameter set of Kepler-37 b in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2106674071344722688, through the CIE 1931 2° observer: #ffeee7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,357 K and log g 4.54 (u1 0.558, u2 0.194): a model, because no fit of this star's limb is used.

**Brightness from Kepler.** The Color + brightness and Brightness map datasets are made in this project from quarters 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15 and 17 of the star's KEPSEISMIC light curve (the newest of April and May 2013), which its authors make from the Kepler mission's pixels and keep at [MAST](https://archive.stsci.edu/hlsp/kepseismic) ([source record](../../sources/mast-kepseismic-light-curves.json)). It is the light curve [Santos et al. (2021, ApJS 255, 17)](https://arxiv.org/abs/2107.02217) judge, and the star's row in their table (VizieR J/ApJS/255/17, table 1) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from Kepler.** Santos et al. (2021, ApJS 255, 17) ask the wavelet, the autocorrelation and their product to give one period in the star's light filtered at 20, 55 and 80 days, selected by the paper's random forest (ROOSTER), by its automatic criteria or by its authors' inspection. Their table (VizieR J/ApJS/255/17, table 1) gives a rotation period of 23.54 ± 3.84 d and a photometric activity (S_ph, the scatter of the light over five rotations) of 356 parts per million: the star's period is 23.54 d, as published, and no criteria were applied to it here. The light varies by 0.12% (the range between its 5th and 95th percentiles, measured here over the quarters mapped; the table prints another measure of it, S_ph). The papers read a period of 23.54 d in the star's light filtered at 55 days, and that is the light curve mapped. 4 of the star's 18 quarters have no map. The papers' rule on a quarter's variance (García et al. 2014) removes quarters 4, 13 and 16, whose variance is 2.39, 2.32 and 3.93 times the median of the star's quarters. Quarter 0 holds less than one turn of the star. For the 20,080 stars also in McQuillan et al. (2014), the paper's periods agree with theirs within 15% for 99.1%. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 9 sectors, and Holcomb et al. (2022) ask for at least 5. The star's record holds 26.01 d from the catalogues. The map's light curve leaves a scatter of 0.01% about the light, whose own noise is 0.003%. Gaia DR3 lists 3 other stars within 16 arcseconds, with 0.42% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-37 e: Weiss et al. 2024's mass 0.02548545 Jupiter masses in 0.03300925 Jupiter radii is 878.7 g/cm^3, outside what the records accept.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-37" (revision 1374406300) verbatim, CC BY-SA 4.0.

- **Brightness from Kepler.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 45.8°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of April and May 2013: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
