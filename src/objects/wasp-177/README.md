# WASP-177

## Sources

Its radius and temperature follow Turner et al. 2019. The introduction is generated from Turner et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2677447294810845824, parallax 5.813 ± 0.020 mas (172.03 pc). Radius 0.885 +/- 0.046 solar radii from Turner et al. 2019, the stellar radius of the default parameter set of WASP-177 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019MNRAS.485.5790T/abstract). Mass 0.876 +/- 0.038 solar masses from Turner et al. 2019, the stellar mass of the default parameter set of WASP-177 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019MNRAS.485.5790T/abstract). Temperature 5,017 K from Turner et al. 2019, the stellar temperature of the default parameter set of WASP-177 b in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Colour.** A Planck spectrum at 5,017 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,017 K and log g 4.49 (u1 0.652, u2 0.124): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
