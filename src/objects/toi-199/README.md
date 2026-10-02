# TOI-199

## Sources

Its radius and temperature follow Hobson et al. 2023. The introduction is generated from Hobson et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4762582895440787712, parallax 9.830 ± 0.011 mas (101.73 pc). Radius 0.82 +/- 0.003 solar radii from Hobson et al. 2023, the stellar radius of the default parameter set of TOI-199 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166..201H/abstract). Mass 0.936 +/- 0.003 solar masses from Hobson et al. 2023, the stellar mass of the default parameter set of TOI-199 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166..201H/abstract). Temperature 5,255 K from Hobson et al. 2023, the stellar temperature of the default parameter set of TOI-199 b in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4762582895440787712, through the CIE 1931 2° observer: #ffe3d1. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,255 K and log g 4.58 (u1 0.585, u2 0.175): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-199 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by transit timing variations).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
