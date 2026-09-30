# TOI-519

## Sources

Its radius and temperature follow Kagetani et al. 2023. The introduction is generated from Kagetani et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5707485527450614656, parallax 8.681 ± 0.037 mas (115.20 pc). Radius 0.35 +/- 0.01 solar radii from Kagetani et al. 2023, the stellar radius of the default parameter set of TOI-519 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023PASJ...75..713K/abstract). Mass 0.335 +/- 0.008 solar masses from Kagetani et al. 2023, the stellar mass of the default parameter set of TOI-519 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023PASJ...75..713K/abstract). Temperature 3,322 K from Kagetani et al. 2023, the stellar temperature of the default parameter set of TOI-519 b in the NASA Exoplanet Archive. log g 4.87 from the mass and radius.

**Colour.** A Planck spectrum at 3,322 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc281. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,322 K and log g 4.87 (u1 0.159, u2 0.455): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
