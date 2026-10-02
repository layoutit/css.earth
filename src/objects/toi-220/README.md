# TOI-220

## Sources

Its radius and temperature follow Hoyer et al. 2021. The introduction is generated from Hoyer et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5481210874877547904, parallax 10.997 ± 0.012 mas (90.93 pc). Radius 0.858 +/- 0.032 solar radii from Hoyer et al. 2021, the stellar radius of the default parameter set of TOI-220 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.505.3361H/abstract). Mass 0.825 +/- 0.028 solar masses from Hoyer et al. 2021, the stellar mass of the default parameter set of TOI-220 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021MNRAS.505.3361H/abstract). Temperature 5,298 K from Hoyer et al. 2021, the stellar temperature of the default parameter set of TOI-220 b in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5481210874877547904, through the CIE 1931 2° observer: #ffebe1. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,298 K and log g 4.49 (u1 0.573, u2 0.183): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
