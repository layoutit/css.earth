# TOI-628

## Sources

Its radius and temperature follow Rodriguez et al. 2021. It is also HD 288842. The introduction is generated from Rodriguez et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3126717023056016256, parallax 5.385 ± 0.025 mas (185.68 pc). Radius 1.345 +/- 0.046 solar radii from Rodriguez et al. 2021, the stellar radius of the default parameter set of TOI-628 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..194R/abstract). Mass 1.311 +/- 0.066 solar masses from Rodriguez et al. 2021, the stellar mass of the default parameter set of TOI-628 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..194R/abstract). Temperature 6,250 K from Rodriguez et al. 2021, the stellar temperature of the default parameter set of TOI-628 b in the NASA Exoplanet Archive. log g 4.3 from the mass and radius.

**Colour.** A Planck spectrum at 6,250 K, because no archive holds a spectrum of this star (stis-ngsl: HD 288842 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #fff6f7. Routes tried in order: stis-ngsl: HD 288842 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,250 K and log g 4.3 (u1 0.377, u2 0.305): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
