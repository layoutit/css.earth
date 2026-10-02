# Kepler-736

## Sources

Its radius and temperature follow Morton et al. 2016. The introduction is generated from Morton et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2106546978971754368, parallax 0.987 ± 0.024 mas (1013.15 pc). Radius 0.81 +/- 0.047 solar radii from Morton et al. 2016, the stellar radius of the default parameter set of Kepler-736 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Mass 0.86 +/- 0.041 solar masses from Morton et al. 2016, the stellar mass of the default parameter set of Kepler-736 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Temperature 5,217 K from Morton et al. 2016, the stellar temperature of the default parameter set of Kepler-736 b in the NASA Exoplanet Archive. log g 4.56 from the mass and radius.

**Color.** A Planck spectrum at 5,217 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe9d7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,217 K and log g 4.56 (u1 0.596, u2 0.167): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
