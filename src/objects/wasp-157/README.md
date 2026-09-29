# WASP-157

## Sources

Its radius and temperature follow Livingston et al. 2018. This account was drafted from Livingston et al. 2018's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3630269399833507200, parallax 2.942 ± 0.028 mas (339.85 pc). Radius 1.1 +/- 0.03 solar radii from Livingston et al. 2018, the stellar radius of the default parameter set of WASP-157 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156..277L/abstract). Mass 1.06 +/- 0.04 solar masses from Livingston et al. 2018, the stellar mass of the default parameter set of WASP-157 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156..277L/abstract). Temperature 5,772 K from Livingston et al. 2018, the stellar temperature of the default parameter set of WASP-157 b in the NASA Exoplanet Archive. log g 4.38 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3630269399833507200, through the CIE 1931 2° observer: #fff0ea. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,772 K and log g 4.38 (u1 0.459, u2 0.260): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
