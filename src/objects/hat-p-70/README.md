# HAT-P-70

## Sources

Its radius and temperature follow Zhou et al. 2019. The introduction is generated from Zhou et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3291455819447952768, parallax 3.143 ± 0.024 mas (318.17 pc). Radius 1.858 +/- 0.119 solar radii from Zhou et al. 2019, the stellar radius of the default parameter set of HAT-P-70 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..141Z/abstract). Mass 1.89 +/- 0.01 solar masses from Zhou et al. 2019, the stellar mass of the default parameter set of HAT-P-70 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..141Z/abstract). Temperature 8,450 K from Zhou et al. 2019, the stellar temperature of the default parameter set of HAT-P-70 b in the NASA Exoplanet Archive. log g 4.18 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3291455819447952768, through the CIE 1931 2° observer: #c7d6ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,450 K and log g 4.18 (u1 0.308, u2 0.318): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
