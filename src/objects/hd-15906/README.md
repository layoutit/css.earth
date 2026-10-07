# HD 15906

## Sources

Its radius and temperature follow Tuson et al. 2023. It is also HIP 11865. The introduction is generated from Tuson et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5175239363214344960, parallax 21.864 ± 0.019 mas (45.74 pc). Radius 0.762 +/- 0.005 solar radii from Tuson et al. 2023, the stellar radius of the default parameter set of HD 15906 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.523.3090T/abstract). Mass 0.79 +/- 0.02 solar masses from Tuson et al. 2023, the stellar mass of the default parameter set of HD 15906 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.523.3090T/abstract). Temperature 4,757 K from Tuson et al. 2023, the stellar temperature of the default parameter set of HD 15906 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Color.** A Planck spectrum at 4,757 K, because no archive holds a spectrum of this star (stis-ngsl: HD 15906 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: HD 15906 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,757 K and log g 4.57 (u1 0.724, u2 0.064): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curve of sector 4 (October and November 2018; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). It is among the light curves [Colman et al. (2024, AJ 167, 189)](https://arxiv.org/abs/2402.14954) searched for rotation, and the star's row in their table (VizieR J/AJ/167/189/fig12) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Colman et al. (2024, AJ 167, 189) ask a sector's light to pass both of the paper's random-forest classifiers (rotation detected; period accurate) with a Lomb-Scargle amplitude of at least 0.01. Their table (VizieR J/AJ/167/189/fig12) gives a rotation period of 11.31 d, the highest peak of the Lomb-Scargle periodogram of the star's one sector among sectors 1 to 26, which passed both of the paper's classifiers: the star's period is 11.31 d, as published, and no criteria were applied to it here. The light varies by 0.38% (the range between its 5th and 95th percentiles, as the table prints it). On the paper's blind test set its first classifier turned away 82% of the stars with no rotation and its second 95% of the inaccurate periods. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 2 sectors, and Holcomb et al. (2022) ask for at least 1. The star's record holds 11.31 d from the catalogues. The map's light curve leaves a scatter of 0.03% about the light, whose own noise is 0.02%. Gaia DR3 lists 1 other star within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 52.4°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of October and November 2018: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
