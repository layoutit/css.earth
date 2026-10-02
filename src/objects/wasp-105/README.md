# WASP-105

## Sources

Its radius and temperature follow Anderson et al. 2017. The introduction is generated from Anderson et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4917441922731087488, parallax 4.603 ± 0.089 mas (217.27 pc); its RUWE is 6.8, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.9 +/- 0.03 solar radii from Anderson et al. 2017, the stellar radius of the default parameter set of WASP-105 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...604A.110A/abstract). Mass 0.89 +/- 0.09 solar masses from Anderson et al. 2017, the stellar mass of the default parameter set of WASP-105 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...604A.110A/abstract). Temperature 5,070 K from Anderson et al. 2017, the stellar temperature of the default parameter set of WASP-105 b in the NASA Exoplanet Archive. log g 4.48 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4917441922731087488, through the CIE 1931 2° observer: #ffe4d0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,070 K and log g 4.48 (u1 0.636, u2 0.136): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
