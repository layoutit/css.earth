# TOI-2285

## Sources

Its radius and temperature follow Fukui et al. 2022. The introduction is generated from Fukui et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2199658670194983040, parallax 23.539 ± 0.015 mas (42.48 pc). Radius 0.464 +/- 0.013 solar radii from Fukui et al. 2022, the stellar radius of the default parameter set of TOI-2285 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022PASJ...74L...1F/abstract). Mass 0.454 +/- 0.01 solar masses from Fukui et al. 2022, the stellar mass of the default parameter set of TOI-2285 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022PASJ...74L...1F/abstract). Temperature 3,491 K from Fukui et al. 2022, the stellar temperature of the default parameter set of TOI-2285 b in the NASA Exoplanet Archive. log g 4.76 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2199658670194983040, through the CIE 1931 2° observer: #ffc588. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,491 K and log g 4.76 (u1 0.177, u2 0.427): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
