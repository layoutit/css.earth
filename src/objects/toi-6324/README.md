# TOI-6324

## Sources

Its radius and temperature follow Lee et al. 2025. The introduction is generated from Lee et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2220012421430629632, parallax 48.641 ± 0.015 mas (20.56 pc). Radius 0.293 +/- 0.01 solar radii from Lee et al. 2025, the stellar radius of the default parameter set of TOI-6324 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJ...983L..36L/abstract). Mass 0.269 +/- 0.012 solar masses from Lee et al. 2025, the stellar mass of the default parameter set of TOI-6324 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJ...983L..36L/abstract). Temperature 3,247 K from Lee et al. 2025, the stellar temperature of the default parameter set of TOI-6324 b in the NASA Exoplanet Archive. log g 4.93 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2220012421430629632, through the CIE 1931 2° observer: #ffcf8a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,247 K and log g 4.93 (u1 0.155, u2 0.468): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
