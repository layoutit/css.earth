# K2-198

## Sources

Its radius and temperature follow Hedges et al. 2019. The introduction is generated from Hedges et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3628687065162340224, parallax 8.966 ± 0.027 mas (111.53 pc); its RUWE is 1.4, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.757 +/- 0.035 solar radii from Hedges et al. 2019, the stellar radius of the default parameter set of K2-198 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019ApJ...880L...5H/abstract). Mass 0.799 +/- 0.091 solar masses from Hedges et al. 2019, the stellar mass of the default parameter set of K2-198 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019ApJ...880L...5H/abstract). Temperature 5,212.9 K from Hedges et al. 2019, the stellar temperature of the default parameter set of K2-198 c in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3628687065162340224, through the CIE 1931 2° observer: #ffe6d5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,212.9 K and log g 4.58 (u1 0.597, u2 0.166): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
