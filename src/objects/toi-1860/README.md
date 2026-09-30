# TOI-1860

## Sources

Its radius and temperature follow Giacalone et al. 2022. It is also HD 134319, HIP 73869. The introduction is generated from Giacalone et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1620024491110370688, parallax 21.862 ± 0.016 mas (45.74 pc). Radius 0.94 +/- 0.02 solar radii from Giacalone et al. 2022, the stellar radius of the default parameter set of TOI-1860 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Mass 0.99 +/- 0.03 solar masses from Giacalone et al. 2022, the stellar mass of the default parameter set of TOI-1860 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Temperature 5,752 K from Giacalone et al. 2022, the stellar temperature of the default parameter set of TOI-1860 b in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1620024491110370688, through the CIE 1931 2° observer: #fff1f0. Routes tried in order: stis-ngsl: HD 134319 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,752 K and log g 4.49 (u1 0.464, u2 0.257): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
