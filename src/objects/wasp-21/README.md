# Tangra

## Sources

Its radius and temperature follow Chen et al. 2020. The introduction is generated from Bouchy et al. 2010's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2831084391023184128, parallax 3.909 ± 0.020 mas (255.82 pc). Radius 1.136 +/- 0.051 solar radii from Chen et al. 2020, the stellar radius of WASP-21 b's parameter set from Chen et al. 2020 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...642A..54C/abstract). Mass 0.89 +/- 0.079 solar masses from Chen et al. 2020, the stellar mass of WASP-21 b's parameter set from Chen et al. 2020 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...642A..54C/abstract). Temperature 5,800 K from Chen et al. 2020, the stellar temperature of WASP-21 b's parameter set from Chen et al. 2020 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.28 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2831084391023184128, through the CIE 1931 2° observer: #fff3f2. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,800 K and log g 4.28 (u1 0.452, u2 0.264): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-21" (revision 1370791513) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
