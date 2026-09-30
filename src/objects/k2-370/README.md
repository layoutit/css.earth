# K2-370

## Sources

Its radius and temperature follow Sozzetti et al. 2024. It is also HD 284521. The introduction is generated from Sozzetti et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 144150720342734208, parallax 7.096 ± 0.020 mas (140.93 pc). Radius 0.945 +/- 0.008 solar radii from Sozzetti et al. 2024, the stellar radius of the default parameter set of K2-370 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.535..531S/abstract). Mass 0.962 +/- 0.035 solar masses from Sozzetti et al. 2024, the stellar mass of the default parameter set of K2-370 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.535..531S/abstract). Temperature 5,662 K from Sozzetti et al. 2024, the stellar temperature of the default parameter set of K2-370 b in the NASA Exoplanet Archive. log g 4.47 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 144150720342734208, through the CIE 1931 2° observer: #ffebde. Routes tried in order: stis-ngsl: HD 284521 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,662 K and log g 4.47 (u1 0.484, u2 0.244): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
