# TOI-1448

## Sources

Its radius and temperature follow Hori et al. 2024. The introduction is generated from Hori et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2189711770761074816, parallax 13.585 ± 0.015 mas (73.61 pc). Radius 0.38 +/- 0.007 solar radii from Hori et al. 2024, the stellar radius of the default parameter set of TOI-1448 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract). Mass 0.372 +/- 0.009 solar masses from Hori et al. 2024, the stellar mass of the default parameter set of TOI-1448 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract). Temperature 3,412 K from Hori et al. 2024, the stellar temperature of the default parameter set of TOI-1448 b in the NASA Exoplanet Archive. log g 4.85 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2189711770761074816, through the CIE 1931 2° observer: #ffc985. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,412 K and log g 4.85 (u1 0.164, u2 0.441): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
