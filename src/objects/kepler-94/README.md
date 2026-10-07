# Kepler-94

## Sources

Its radius and temperature follow Marcy et al. 2014. The introduction is generated from Marcy et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2119602202081351168, parallax 5.248 ± 0.011 mas (190.56 pc). Radius 0.76 +/- 0.03 solar radii from Marcy et al. 2014, the stellar radius of the default parameter set of Kepler-94 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJS..210...20M/abstract). Mass 0.81 +/- 0.06 solar masses from Marcy et al. 2014, the stellar mass of the default parameter set of Kepler-94 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJS..210...20M/abstract). Temperature 4,781 K from Marcy et al. 2014, the stellar temperature of the default parameter set of Kepler-94 b in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2119602202081351168, through the CIE 1931 2° observer: #ffcfad. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,781 K and log g 4.58 (u1 0.718, u2 0.069): a model, because no fit of this star's limb is used.

**Brightness from Kepler.** The Color + brightness and Brightness map datasets are made in this project from quarters 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 14 and 16 of the star's KEPSEISMIC light curve (the newest of January to April 2013), which its authors make from the Kepler mission's pixels and keep at [MAST](https://archive.stsci.edu/hlsp/kepseismic) ([source record](../../sources/mast-kepseismic-light-curves.json)). It is the light curve [Santos et al. (2019, ApJS 244, 21)](https://arxiv.org/abs/1908.05222) judge, and the star's row in their table (VizieR J/ApJS/244/21, table 3) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from Kepler.** Santos et al. (2019, ApJS 244, 21) ask the wavelet, the autocorrelation and their product to give one period in the star's light filtered at 20, 55 and 80 days, selected by the paper's automatic criteria or by its authors' inspection. Their table (VizieR J/ApJS/244/21, table 3) gives a rotation period of 50.11 ± 6.67 d and a photometric activity (S_ph, the scatter of the light over five rotations) of 746 parts per million: the star's period is 50.11 d, as published, and no criteria were applied to it here. The light varies by 0.25% (the range between its 5th and 95th percentiles, measured here over the quarters mapped; the table prints another measure of it, S_ph). The papers read a period of 50.11 d in the star's light filtered at 55 days, and that is the light curve mapped. 6 of the star's 18 quarters have no map. The papers' rule on a quarter's variance (García et al. 2014) removes quarters 5, 13 and 15, whose variance is 2.77, 4.21 and 3.94 times the median of the star's quarters. Quarters 0, 1 and 17 hold less than one turn of the star. For the 11,209 stars also in McQuillan et al. (2013, 2014), the paper's periods agree with theirs within two sigma for 99.4%. The star's record holds 44.31 d from the catalogues. The map's light curve leaves a scatter of 0.06% about the light, whose own noise is 0.01%. Gaia DR3 lists 2 other stars within 16 arcseconds, with 1.5% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-94 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

- **Brightness from Kepler.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 35.2°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of January to April 2013: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
