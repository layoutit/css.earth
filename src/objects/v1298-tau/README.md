# V1298 Tau

## Sources

Its radius and temperature follow Livingston et al. 2026. The introduction is generated from Livingston et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 51886335968692480, parallax 9.258 ± 0.020 mas (108.02 pc). Radius 1.32 +/- 0.05 solar radii from Livingston et al. 2026, the stellar radius of the default parameter set of V1298 Tau c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026Natur.649..310L/abstract). Mass 1.1 +/- 0.05 solar masses from Livingston et al. 2026, the stellar mass of the default parameter set of V1298 Tau c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026Natur.649..310L/abstract). Temperature 4,970 K from Livingston et al. 2026, the stellar temperature of the default parameter set of V1298 Tau c in the NASA Exoplanet Archive. log g 4.24 from the mass and radius.

**Color.** A Planck spectrum at 4,970 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,970 K and log g 4.24 (u1 0.661, u2 0.118): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 4 (February to April 2015; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is the light curve [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 4 the light varies by 4.6% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give 2.85, 2.81 and 2.88 d, and the periodogram's peak has a height of 0.68: within what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three within a day of each other, a peak over 0.3). The period is their mean, 2.84 d. Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The star's record holds 2.91 d from the catalogues. The map's light curve leaves a scatter of 0.79% about the light, whose own noise is 0.34%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** V1298 Tau b: Livingston et al. 2026's mass 0.04121721 Jupiter masses in 0.83950542 Jupiter radii is 0.1 g/cm^3, outside what the records accept.
- **Not shown.** V1298 Tau e: Livingston et al. 2026's mass 0.04813918 Jupiter masses in 0.90730819 Jupiter radii is 0.1 g/cm^3, outside what the records accept.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "V1298 Tauri" (revision 1370790833) verbatim, CC BY-SA 4.0.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of February to April 2015: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
