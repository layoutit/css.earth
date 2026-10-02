# K2-344

## Sources

Its radius and temperature follow de Leon et al. 2021. The introduction is generated from de Leon et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 685235991691684352, parallax 13.247 ± 0.018 mas (75.49 pc). Radius 0.49 +/- 0.01 solar radii from de Leon et al. 2021, the stellar radius of the default parameter set of K2-344 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.508..195D/abstract). Mass 0.51 +/- 0.01 solar masses from de Leon et al. 2021, the stellar mass of the default parameter set of K2-344 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.508..195D/abstract). Temperature 4,374 K from de Leon et al. 2021, the stellar temperature of the default parameter set of K2-344 b in the NASA Exoplanet Archive. log g 4.77 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 685235991691684352, through the CIE 1931 2° observer: #ffbe88. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,374 K and log g 4.77 (u1 0.724, u2 0.062): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
