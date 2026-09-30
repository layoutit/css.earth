# TOI-1011

## Sources

Its radius and temperature follow Brinkman et al. 2025. It is also HD 61051, HIP 36964. The introduction is generated from Brinkman et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5592015297342611968, parallax 19.091 ± 0.013 mas (52.38 pc). Radius 0.92 +/- 0.03 solar radii from Brinkman et al. 2025, the stellar radius of the default parameter set of TOI-1011 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..109B/abstract). Mass 0.91 +/- 0.03 solar masses from Brinkman et al. 2025, the stellar mass of the default parameter set of TOI-1011 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..109B/abstract). Temperature 5,475 K from Brinkman et al. 2025, the stellar temperature of the default parameter set of TOI-1011 b in the NASA Exoplanet Archive. log g 4.47 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5592015297342611968, through the CIE 1931 2° observer: #ffede4. Routes tried in order: stis-ngsl: HD 61051 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,475 K and log g 4.47 (u1 0.527, u2 0.216): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
