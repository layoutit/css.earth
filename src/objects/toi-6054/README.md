# TOI-6054

## Sources

Its radius and temperature follow Kroft et al. 2025. It is also HD 23074, HIP 17540. The introduction is generated from Kroft et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 474143193821024256, parallax 12.701 ± 0.019 mas (78.73 pc). Radius 1.662 +/- 0.071 solar radii from Kroft et al. 2025, the stellar radius of the default parameter set of TOI-6054.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..150K/abstract). Mass 1.107 +/- 0.04 solar masses from Kroft et al. 2025, the stellar mass of the default parameter set of TOI-6054.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..150K/abstract). Temperature 6,047 K from Kroft et al. 2025, the stellar temperature of the default parameter set of TOI-6054.01 in the NASA Exoplanet Archive. log g 4.04 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 474143193821024256, through the CIE 1931 2° observer: #fbf6ff. Routes tried in order: stis-ngsl: HD 23074 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,047 K and log g 4.04 (u1 0.405, u2 0.291): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
