# K2-352

## Sources

Its radius and temperature follow de Leon et al. 2021. The introduction is generated from de Leon et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 632634358985725184, parallax 5.615 ± 0.026 mas (178.11 pc). Radius 0.95 +/- 0.02 solar radii from de Leon et al. 2021, the stellar radius of the default parameter set of K2-352 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.508..195D/abstract). Mass 0.98 +/- 0.04 solar masses from de Leon et al. 2021, the stellar mass of the default parameter set of K2-352 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.508..195D/abstract). Temperature 5,791 K from de Leon et al. 2021, the stellar temperature of the default parameter set of K2-352 b in the NASA Exoplanet Archive. log g 4.47 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 632634358985725184, through the CIE 1931 2° observer: #fff2ee. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,791 K and log g 4.47 (u1 0.456, u2 0.262): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
