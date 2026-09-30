# TOI-2211

## Sources

Its radius and temperature follow Crossfield et al. 2025. It is also HD 195755, HIP 101503. The introduction is generated from Crossfield et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6796762076358897408, parallax 14.194 ± 0.015 mas (70.45 pc). Radius 0.834 +/- 0.047 solar radii from Crossfield et al. 2025, the stellar radius of the default parameter set of TOI-2211.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Mass 0.9 +/- 0.11 solar masses from Crossfield et al. 2025, the stellar mass of the default parameter set of TOI-2211.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Temperature 5,253 K from Crossfield et al. 2025, the stellar temperature of the default parameter set of TOI-2211.01 in the NASA Exoplanet Archive. log g 4.55 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 6796762076358897408, through the CIE 1931 2° observer: #ffe8db. Routes tried in order: stis-ngsl: HD 195755 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,253 K and log g 4.55 (u1 0.585, u2 0.175): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
