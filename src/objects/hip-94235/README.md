# HIP 94235

## Sources

Its radius and temperature follow Zhou et al. 2022. It is also HD 178085. The introduction is generated from Zhou et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6632318361397624960, parallax 17.081 ± 0.021 mas (58.55 pc). Radius 1.08 +/- 0.11 solar radii from Zhou et al. 2022, the stellar radius of the default parameter set of HIP 94235 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..289Z/abstract). Mass 1.094 +/- 0.024 solar masses from Zhou et al. 2022, the stellar mass of the default parameter set of HIP 94235 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..289Z/abstract). Temperature 5,991 K from Zhou et al. 2022, the stellar temperature of the default parameter set of HIP 94235 b in the NASA Exoplanet Archive. log g 4.41 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6632318361397624960, through the CIE 1931 2° observer: #fff6fc. Routes tried in order: stis-ngsl: HD 178085 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,991 K and log g 4.41 (u1 0.416, u2 0.285): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
