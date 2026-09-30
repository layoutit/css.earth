# TOI-262

## Sources

Its radius and temperature follow Oddo et al. 2023. It is also HD 13386, HIP 10117. The introduction is generated from Oddo et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5019835424832215424, parallax 22.653 ± 0.017 mas (44.14 pc). Radius 0.853 +/- 0.021 solar radii from Oddo et al. 2023, the stellar radius of the default parameter set of TOI-262 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..134O/abstract). Mass 0.913 +/- 0.029 solar masses from Oddo et al. 2023, the stellar mass of the default parameter set of TOI-262 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..134O/abstract). Temperature 5,310 K from Oddo et al. 2023, the stellar temperature of the default parameter set of TOI-262 b in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5019835424832215424, through the CIE 1931 2° observer: #ffe5d4. Routes tried in order: stis-ngsl: HD 13386 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,310 K and log g 4.54 (u1 0.571, u2 0.185): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
