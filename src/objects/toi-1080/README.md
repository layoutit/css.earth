# TOI-1080

## Sources

Its radius and temperature follow Gómez Maqueo Chew et al. 2026. The introduction is generated from Gómez Maqueo Chew et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6653968157663516672, parallax 39.132 ± 0.022 mas (25.55 pc). Radius 0.2019 +/- 0.0075 solar radii from Gómez Maqueo Chew et al. 2026, the stellar radius of the default parameter set of TOI-1080 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.548ag438G/abstract). Mass 0.1667 +/- 0.0041 solar masses from Gómez Maqueo Chew et al. 2026, the stellar mass of the default parameter set of TOI-1080 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.548ag438G/abstract). Temperature 3,065 K from Gómez Maqueo Chew et al. 2026, the stellar temperature of the default parameter set of TOI-1080 b in the NASA Exoplanet Archive. log g 5.05 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6653968157663516672, through the CIE 1931 2° observer: #ffc676. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,065 K and log g 5.05 (u1 0.172, u2 0.508): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
