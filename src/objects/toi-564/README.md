# TOI-564

## Sources

Its radius and temperature follow Davis et al. 2020. The introduction is generated from Davis et al. 2020's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5710154317045164416, parallax 5.030 ± 0.019 mas (198.80 pc). Radius 1.088 +/- 0.014 solar radii from Davis et al. 2020, the stellar radius of the default parameter set of TOI-564 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..229D/abstract). Mass 0.998 +/- 0.068 solar masses from Davis et al. 2020, the stellar mass of the default parameter set of TOI-564 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..229D/abstract). Temperature 5,640 K from Davis et al. 2020, the stellar temperature of the default parameter set of TOI-564 b in the NASA Exoplanet Archive. log g 4.36 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5710154317045164416, through the CIE 1931 2° observer: #ffeee6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,640 K and log g 4.36 (u1 0.488, u2 0.242): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
