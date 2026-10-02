# K2-174

## Sources

Its radius and temperature follow Livingston et al. 2019. The introduction is generated from Livingston et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 46217666333148416, parallax 9.978 ± 0.017 mas (100.22 pc); its RUWE is 1.4, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.676 +/- 0.008 solar radii from Livingston et al. 2019, the stellar radius of the default parameter set of K2-174 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157..102L/abstract). Mass 0.7 +/- 0.025 solar masses from Livingston et al. 2019, the stellar mass of the default parameter set of K2-174 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157..102L/abstract). Temperature 4,455 K from Livingston et al. 2019, the stellar temperature of the default parameter set of K2-174 b in the NASA Exoplanet Archive. log g 4.62 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 46217666333148416, through the CIE 1931 2° observer: #ffc7a2. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,455 K and log g 4.62 (u1 0.770, u2 0.024): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
