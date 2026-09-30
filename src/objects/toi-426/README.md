# TOI-426

## Sources

Its radius and temperature follow Castro-González et al. 2026. It is also HD 34390. The introduction is generated from Castro-González et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2983316311375470976, parallax 8.863 ± 0.018 mas (112.83 pc). Radius 0.99 +/- 0.03 solar radii from Castro-González et al. 2026, the stellar radius of the default parameter set of TOI-426 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260905413C/abstract). Mass 1 +/- 0.02 solar masses from Castro-González et al. 2026, the stellar mass of the default parameter set of TOI-426 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260905413C/abstract). Temperature 5,750 K from Castro-González et al. 2026, the stellar temperature of the default parameter set of TOI-426 b in the NASA Exoplanet Archive. log g 4.45 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2983316311375470976, through the CIE 1931 2° observer: #fff1ee. Routes tried in order: stis-ngsl: HD 34390 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,750 K and log g 4.45 (u1 0.464, u2 0.257): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-426 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
