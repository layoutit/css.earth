# Kepler-411

## Sources

Its radius follows Sun et al. 2019, and its temperature TICv8. The introduction is generated from Sun et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2132768956905956352, parallax 6.531 ± 0.008 mas (153.11 pc). Radius 0.82 +/- 0.018 solar radii from Sun et al. 2019, the stellar radius of the default parameter set of Kepler-411 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...624A..15S/abstract). Mass 0.87 +/- 0.039 solar masses from Sun et al. 2019, the stellar mass of the default parameter set of Kepler-411 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...624A..15S/abstract). Temperature 4,837 K from TICv8, the stellar temperature of Kepler-411 c's parameter set from TICv8 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.55 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2132768956905956352, through the CIE 1931 2° observer: #ffd7bc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,837 K and log g 4.55 (u1 0.702, u2 0.082): a model, because no fit of this star's limb is used.

**Brightness from Kepler.** The Color + brightness and Brightness map datasets are made in this project from quarters 1, 3, 4, 6, 7, 9, 10, 11, 13, 14, 15 and 17 of the star's KEPSEISMIC light curve (the newest of April and May 2013), which its authors make from the Kepler mission's pixels and keep at [MAST](https://archive.stsci.edu/hlsp/kepseismic) ([source record](../../sources/mast-kepseismic-light-curves.json)). It is the light curve [Santos et al. (2019, ApJS 244, 21)](https://arxiv.org/abs/1908.05222) judge, and the star's row in their table (VizieR J/ApJS/244/21, table 3) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from Kepler.** Santos et al. (2019, ApJS 244, 21) ask the wavelet, the autocorrelation and their product to give one period in the star's light filtered at 20, 55 and 80 days, selected by the paper's automatic criteria or by its authors' inspection. Their table (VizieR J/ApJS/244/21, table 3) gives a rotation period of 10.32 ± 0.75 d and a photometric activity (S_ph, the scatter of the light over five rotations) of 6180 parts per million: the star's period is 10.32 d, as published, and no criteria were applied to it here. The light varies by 2.0% (the range between its 5th and 95th percentiles, measured here over the quarters mapped; the table prints another measure of it, S_ph). The papers read a period of 10.32 d in the star's light filtered at 20 days, and that is the light curve mapped. 3 of the star's 15 quarters have no map. The papers' rule on a quarter's variance (García et al. 2014) removes quarters 2 and 5, whose variance is 3.86 and 3.07 times the median of the star's quarters. Quarter 0 holds less than one turn of the star. For the 11,209 stars also in McQuillan et al. (2013, 2014), the paper's periods agree with theirs within two sigma for 99.4%. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 4 of the star's 12 sectors, and Holcomb et al. (2022) ask for at least 6. The star's record holds 10.4 d from the catalogues. The map's light curve leaves a scatter of 0.31% about the light, whose own noise is 0.04%. Gaia DR3 lists 2 other stars within 16 arcseconds, with 10% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-411 b: Sun et al. 2019's mass 0.0805462 Jupiter masses in 0.21420287 Jupiter radii is 10.2 g/cm^3, outside what the records accept.
- **Not shown.** Kepler-411 e: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by transit timing variations).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-411" (revision 1373917633) verbatim, CC BY-SA 4.0.

- **Brightness from Kepler.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of April and May 2013: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
