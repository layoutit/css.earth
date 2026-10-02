# K2-284

## Sources

Its radius and temperature follow David et al. 2018. The introduction is generated from David et al. 2018's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3413793491812093824, parallax 9.409 ± 0.016 mas (106.29 pc). Radius 0.607 +/- 0.022 solar radii from David et al. 2018, the stellar radius of the default parameter set of K2-284 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156..302D/abstract). Mass 0.63 +/- 0.01 solar masses from David et al. 2018, the stellar mass of the default parameter set of K2-284 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156..302D/abstract). Temperature 4,140 K from David et al. 2018, the stellar temperature of the default parameter set of K2-284 b in the NASA Exoplanet Archive. log g 4.67 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3413793491812093824, through the CIE 1931 2° observer: #ffc092. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,140 K and log g 4.67 (u1 0.644, u2 0.131): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
