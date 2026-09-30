# WASP-140

## Sources

Its radius follows Hellier et al. 2017, and its temperature Alexoudi 2022. The introduction is generated from Alexoudi 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5094154336332482304, parallax 8.563 ± 0.019 mas (116.78 pc). Radius 0.87 +/- 0.04 solar radii from Hellier et al. 2017, the stellar radius of WASP-140 b's parameter set from Hellier et al. 2017 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017MNRAS.465.3693H/abstract). Mass 0.9 +/- 0.04 solar masses from Hellier et al. 2017, the stellar mass of WASP-140 b's parameter set from Hellier et al. 2017 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017MNRAS.465.3693H/abstract). Temperature 5,300 K from Alexoudi 2022, the stellar temperature of the default parameter set of WASP-140 b in the NASA Exoplanet Archive. log g 4.51 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5094154336332482304, through the CIE 1931 2° observer: #ffe9da. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,300 K and log g 4.51 (u1 0.573, u2 0.184): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
