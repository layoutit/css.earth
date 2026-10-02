# HD 25463

## Sources

Its radius and temperature follow MacDougall et al. 2023. It is also HIP 18893. The introduction is generated from MacDougall et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3301771025223950336, parallax 22.131 ± 0.025 mas (45.18 pc). Radius 1.4182 +/- 0.0241 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of HD 25463 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 1.251 +/- 0.0248 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of HD 25463 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 6,353 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of HD 25463 b in the NASA Exoplanet Archive. log g 4.23 from the mass and radius.

**Color.** A Planck spectrum at 6,353 K, because no archive holds a spectrum of this star (stis-ngsl: HD 25463 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #fff7fa. Routes tried in order: stis-ngsl: HD 25463 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,353 K and log g 4.23 (u1 0.366, u2 0.309): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** HD 25463 c: Polanski et al. 2024's mass 0.01352931 Jupiter masses in 0.12164795 Jupiter radii is 9.3 g/cm^3, outside what the records accept.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
