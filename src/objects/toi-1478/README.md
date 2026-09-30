# TOI-1478

## Sources

Its radius and temperature follow Rodriguez et al. 2021. The introduction is generated from Rice et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5723638723350902400, parallax 6.565 ± 0.014 mas (152.33 pc). Radius 1.048 +/- 0.03 solar radii from Rodriguez et al. 2021, the stellar radius of TOI-1478 b's parameter set from Rodriguez et al. 2021 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..194R/abstract). Mass 0.947 +/- 0.059 solar masses from Rodriguez et al. 2021, the stellar mass of TOI-1478 b's parameter set from Rodriguez et al. 2021 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..194R/abstract). Temperature 5,597 K from Rodriguez et al. 2021, the stellar temperature of TOI-1478 b's parameter set from Rodriguez et al. 2021 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5723638723350902400, through the CIE 1931 2° observer: #fff0e9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,597 K and log g 4.37 (u1 0.498, u2 0.235): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
