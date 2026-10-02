# TOI-1246

## Sources

Its radius and temperature follow Turtelboom et al. 2022. The introduction is generated from Turtelboom et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1650110904522335744, parallax 5.847 ± 0.011 mas (171.03 pc). Radius 0.86 +/- 0.05 solar radii from Turtelboom et al. 2022, the stellar radius of the default parameter set of TOI-1246 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..293T/abstract). Mass 0.87 +/- 0.03 solar masses from Turtelboom et al. 2022, the stellar mass of the default parameter set of TOI-1246 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..293T/abstract). Temperature 5,151 K from Turtelboom et al. 2022, the stellar temperature of the default parameter set of TOI-1246 b in the NASA Exoplanet Archive. log g 4.51 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1650110904522335744, through the CIE 1931 2° observer: #ffe3d1. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,151 K and log g 4.51 (u1 0.614, u2 0.153): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
