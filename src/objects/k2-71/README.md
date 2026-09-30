# K2-71

## Sources

Its radius and temperature follow Crossfield et al. 2016. The introduction is generated from Crossfield et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2608279114251674624, parallax 6.480 ± 0.032 mas (154.32 pc). Radius 0.426 +/- 0.049 solar radii from Crossfield et al. 2016, the stellar radius of the default parameter set of K2-71 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJS..226....7C/abstract). Mass 0.477 +/- 0.063 solar masses from Crossfield et al. 2016, the stellar mass of the default parameter set of K2-71 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJS..226....7C/abstract). Temperature 4,006 K from Crossfield et al. 2016, the stellar temperature of the default parameter set of K2-71 b in the NASA Exoplanet Archive. log g 4.86 from the mass and radius.

**Colour.** A Planck spectrum at 4,006 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffd3a5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,006 K and log g 4.86 (u1 0.471, u2 0.277): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
