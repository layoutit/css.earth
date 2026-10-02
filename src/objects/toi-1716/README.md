# TOI-1716

## Sources

Its radius and temperature follow Crossfield et al. 2025. It is also HD 237566. The introduction is generated from Crossfield et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1000423609817438592, parallax 9.625 ± 0.020 mas (103.90 pc). Radius 1.24 +/- 0.07 solar radii from Crossfield et al. 2025, the stellar radius of the default parameter set of TOI-1716.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Mass 1.07 +/- 0.14 solar masses from Crossfield et al. 2025, the stellar mass of the default parameter set of TOI-1716.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Temperature 5,879 K from Crossfield et al. 2025, the stellar temperature of the default parameter set of TOI-1716.01 in the NASA Exoplanet Archive. log g 4.28 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1000423609817438592, through the CIE 1931 2° observer: #fff5f8. Routes tried in order: stis-ngsl: HD 237566 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,879 K and log g 4.28 (u1 0.437, u2 0.273): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
