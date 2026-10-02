# TOI-2015

## Sources

Its radius and temperature follow Barkaoui et al. 2025. The introduction is generated from Barkaoui et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1270814787767025408, parallax 21.131 ± 0.018 mas (47.32 pc). Radius 0.3273 +/- 0.0029 solar radii from Barkaoui et al. 2025, the stellar radius of the default parameter set of TOI-2015 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...695A.281B/abstract). Mass 0.3041 +/- 0.0353 solar masses from Barkaoui et al. 2025, the stellar mass of the default parameter set of TOI-2015 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...695A.281B/abstract). Temperature 3,297 K from Barkaoui et al. 2025, the stellar temperature of the default parameter set of TOI-2015 b in the NASA Exoplanet Archive. log g 4.89 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1270814787767025408, through the CIE 1931 2° observer: #ffcc83. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,297 K and log g 4.89 (u1 0.157, u2 0.459): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-2015 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by transit timing variations).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
