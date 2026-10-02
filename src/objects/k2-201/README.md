# K2-201

## Sources

Its radius and temperature follow Mayo et al. 2018. The introduction is generated from Mayo et al. 2018's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6771370981322320128, parallax 5.093 ± 0.015 mas (196.35 pc). Radius 0.878161 +/- 0.02908 solar radii from Mayo et al. 2018, the stellar radius of the default parameter set of K2-201 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....155..136M/abstract). Mass 0.956055 +/- 0.019958 solar masses from Mayo et al. 2018, the stellar mass of the default parameter set of K2-201 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....155..136M/abstract). Temperature 5,507 K from Mayo et al. 2018, the stellar temperature of the default parameter set of K2-201 b in the NASA Exoplanet Archive. log g 4.53 from the mass and radius.

**Color.** A Planck spectrum at 5,507 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffede1. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,507 K and log g 4.53 (u1 0.520, u2 0.221): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
