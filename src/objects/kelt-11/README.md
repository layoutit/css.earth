# KELT-11

## Sources

Its radius and temperature follow Mounzer et al. 2022. It is also HD 93396, HIP 52733. The introduction is generated from Mounzer et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3761497761876022400, parallax 10.005 ± 0.020 mas (99.95 pc). Radius 2.69 +/- 0.04 solar radii from Mounzer et al. 2022, the stellar radius of the default parameter set of KELT-11 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...668A...1M/abstract). Mass 1.44 +/- 0.07 solar masses from Mounzer et al. 2022, the stellar mass of the default parameter set of KELT-11 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...668A...1M/abstract). Temperature 5,375 K from Mounzer et al. 2022, the stellar temperature of the default parameter set of KELT-11 b in the NASA Exoplanet Archive. log g 3.74 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3761497761876022400, through the CIE 1931 2° observer: #ffebdc. Routes tried in order: stis-ngsl: HD 93396 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,375 K and log g 3.74 (u1 0.543, u2 0.206): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
