# WASP-131

## Sources

Its radius and temperature follow Doyle et al. 2023. It is also HD 122173. The introduction is generated from Doyle et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6173451477191225984, parallax 5.176 ± 0.036 mas (193.18 pc); its RUWE is 1.9, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 1.561 +/- 0.043 solar radii from Doyle et al. 2023, the stellar radius of the default parameter set of WASP-131 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.522.4499D/abstract). Mass 1.06 +/- 0.068 solar masses from Doyle et al. 2023, the stellar mass of the default parameter set of WASP-131 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.522.4499D/abstract). Temperature 5,990 K from Doyle et al. 2023, the stellar temperature of the default parameter set of WASP-131 b in the NASA Exoplanet Archive. log g 4.08 from the mass and radius.

**Color.** A Planck spectrum at 5,990 K, because no archive holds a spectrum of this star (stis-ngsl: HD 122173 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #fff3f0. Routes tried in order: stis-ngsl: HD 122173 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,990 K and log g 4.08 (u1 0.414, u2 0.287): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
