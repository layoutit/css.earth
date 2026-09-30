# TOI-3757

## Sources

Its radius and temperature follow Kanodia et al. 2022. The introduction is generated from Kanodia et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 996878131494639488, parallax 5.598 ± 0.021 mas (178.63 pc). Radius 0.62 +/- 0.01 solar radii from Kanodia et al. 2022, the stellar radius of the default parameter set of TOI-3757 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...81K/abstract). Mass 0.64 +/- 0.02 solar masses from Kanodia et al. 2022, the stellar mass of the default parameter set of TOI-3757 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...81K/abstract). Temperature 3,913 K from Kanodia et al. 2022, the stellar temperature of the default parameter set of TOI-3757 b in the NASA Exoplanet Archive. log g 4.66 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 996878131494639488, through the CIE 1931 2° observer: #ffbd8b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,913 K and log g 4.66 (u1 0.500, u2 0.259): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
