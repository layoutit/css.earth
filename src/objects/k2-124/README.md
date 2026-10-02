# K2-124

## Sources

Its radius and temperature follow Livingston et al. 2019. The introduction is generated from Livingston et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 686230534318440960, parallax 7.275 ± 0.042 mas (137.46 pc). Radius 0.388 +/- 0.016 solar radii from Livingston et al. 2019, the stellar radius of the default parameter set of K2-124 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157..102L/abstract). Mass 0.39 +/- 0.013 solar masses from Livingston et al. 2019, the stellar mass of the default parameter set of K2-124 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157..102L/abstract). Temperature 3,570 K from Livingston et al. 2019, the stellar temperature of the default parameter set of K2-124 b in the NASA Exoplanet Archive. log g 4.85 from the mass and radius.

**Color.** A Planck spectrum at 3,570 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc98f. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,570 K and log g 4.85 (u1 0.385, u2 0.378): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
