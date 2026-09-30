# TOI-257

## Sources

Its radius and temperature follow Addison et al. 2021. It is also HD 19916, HIP 14710. The introduction is generated from Addison et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4747624104168195072, parallax 13.011 ± 0.017 mas (76.86 pc). Radius 1.867 +/- 0.033 solar radii from Addison et al. 2021, the stellar radius of the default parameter set of TOI-257 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.502.3704A/abstract). Mass 1.407 +/- 0.045 solar masses from Addison et al. 2021, the stellar mass of the default parameter set of TOI-257 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.502.3704A/abstract). Temperature 6,095 K from Addison et al. 2021, the stellar temperature of the default parameter set of TOI-257 b in the NASA Exoplanet Archive. log g 4.04 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4747624104168195072, through the CIE 1931 2° observer: #fff8ff. Routes tried in order: stis-ngsl: HD 19916 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,095 K and log g 4.04 (u1 0.398, u2 0.294): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
