# TOI-5349

## Sources

Its radius and temperature follow Sandoval et al. 2026. The introduction is generated from Sandoval et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 58372904816938240, parallax 5.262 ± 0.026 mas (190.06 pc). Radius 0.58 +/- 0.01 solar radii from Sandoval et al. 2026, the stellar radius of the default parameter set of TOI-5349 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....171...43S/abstract). Mass 0.61 +/- 0.02 solar masses from Sandoval et al. 2026, the stellar mass of the default parameter set of TOI-5349 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....171...43S/abstract). Temperature 3,751 K from Sandoval et al. 2026, the stellar temperature of the default parameter set of TOI-5349 b in the NASA Exoplanet Archive. log g 4.7 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 58372904816938240, through the CIE 1931 2° observer: #ffc085. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,751 K and log g 4.7 (u1 0.402, u2 0.349): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
