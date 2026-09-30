# TOI-3884

## Sources

Its radius and temperature follow Libby-Roberts et al. 2023. The introduction is generated from Libby-Roberts et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3919169687804622336, parallax 23.016 ± 0.026 mas (43.45 pc). Radius 0.302 +/- 0.012 solar radii from Libby-Roberts et al. 2023, the stellar radius of the default parameter set of TOI-3884 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..249L/abstract). Mass 0.298 +/- 0.018 solar masses from Libby-Roberts et al. 2023, the stellar mass of the default parameter set of TOI-3884 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..249L/abstract). Temperature 3,180 K from Libby-Roberts et al. 2023, the stellar temperature of the default parameter set of TOI-3884 b in the NASA Exoplanet Archive. log g 4.95 from the mass and radius.

**Colour.** A Planck spectrum at 3,180 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffbd79. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,180 K and log g 4.95 (u1 0.155, u2 0.481): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
