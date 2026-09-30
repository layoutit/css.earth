# K2-417

## Sources

Its radius and temperature follow Incha et al. 2023. The introduction is generated from Incha et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2437684039751295744, parallax 10.641 ± 0.015 mas (93.98 pc). Radius 0.5776 +/- 0.004 solar radii from Incha et al. 2023, the stellar radius of the default parameter set of K2-417 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.523..474I/abstract). Mass 0.569 +/- 0.012 solar masses from Incha et al. 2023, the stellar mass of the default parameter set of K2-417 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.523..474I/abstract). Temperature 3,861 K from Incha et al. 2023, the stellar temperature of the default parameter set of K2-417 b in the NASA Exoplanet Archive. log g 4.67 from the mass and radius.

**Colour.** A Planck spectrum at 3,861 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffd09e. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,861 K and log g 4.67 (u1 0.469, u2 0.288): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
