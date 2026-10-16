# WASP-100

## Sources

Its radius and temperature follow Stassun et al. 2017. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4675352109659600000, parallax 2.808 ± 0.013 mas (356.14 pc). Radius 1.57 +/- 0.16 solar radii from Stassun et al. 2017, the stellar radius of the default parameter set of WASP-100 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Mass 0.77 +/- 0.42 solar masses from Stassun et al. 2017, the stellar mass of the default parameter set of WASP-100 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Temperature 6,900 K from Stassun et al. 2017, the stellar temperature of the default parameter set of WASP-100 b in the NASA Exoplanet Archive. log g 3.93 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4675352109659600000, through the CIE 1931 2° observer: #ebecff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,900 K and log g 3.93 (u1 0.318, u2 0.329): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-15 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
