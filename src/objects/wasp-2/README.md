# WASP-2

## Sources

Its radius and temperature follow Addison et al. 2019. The introduction is generated from Addison et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1748596020745038208, parallax 6.578 ± 0.027 mas (152.03 pc); its RUWE is 1.6, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.866 +/- 0.031 solar radii from Addison et al. 2019, the stellar radius of the default parameter set of WASP-2 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019PASP..131k5003A/abstract). Mass 0.895 +/- 0.077 solar masses from Addison et al. 2019, the stellar mass of the default parameter set of WASP-2 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019PASP..131k5003A/abstract). Temperature 5,180 K from Addison et al. 2019, the stellar temperature of the default parameter set of WASP-2 b in the NASA Exoplanet Archive. log g 4.51 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1748596020745038208, through the CIE 1931 2° observer: #ffe3d1. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,180 K and log g 4.51 (u1 0.606, u2 0.159): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-2" (revision 1353976460) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
