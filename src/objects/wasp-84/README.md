# WASP-84

## Sources

Its radius follows Maciejewski et al. 2023, and its temperature Bonomo et al. 2017. The introduction is generated from Maciejewski et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3078836109158636928, parallax 9.964 ± 0.015 mas (100.37 pc). Radius 0.768 +/- 0.019 solar radii from Maciejewski et al. 2023, the stellar radius of the default parameter set of WASP-84 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.525L..43M/abstract). Mass 0.853 +/- 0.038 solar masses from Maciejewski et al. 2023, the stellar mass of the default parameter set of WASP-84 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.525L..43M/abstract). Temperature 5,300 K from Bonomo et al. 2017, the stellar temperature of WASP-84 b's parameter set from Bonomo et al. 2017 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.6 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3078836109158636928, through the CIE 1931 2° observer: #ffe6d6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,300 K and log g 4.6 (u1 0.574, u2 0.183): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** WASP-84 c: Maciejewski et al. 2023's mass 0.048 Jupiter masses in 0.174 Jupiter radii is 11.3 g/cm^3, outside what the records accept.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-84" (revision 1374406445) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
