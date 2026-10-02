# TOI-198

## Sources

Its radius and temperature follow Zapatero Osorio et al. 2026. It is also HIP 738. The introduction is generated from Zapatero Osorio et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2333676738050041728, parallax 42.059 ± 0.032 mas (23.78 pc). Radius 0.418 +/- 0.029 solar radii from Zapatero Osorio et al. 2026, the stellar radius of the default parameter set of TOI-198 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...706A.166Z/abstract). Mass 0.417 +/- 0.045 solar masses from Zapatero Osorio et al. 2026, the stellar mass of the default parameter set of TOI-198 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...706A.166Z/abstract). Temperature 3,801 K from Zapatero Osorio et al. 2026, the stellar temperature of the default parameter set of TOI-198 b in the NASA Exoplanet Archive. log g 4.82 from the mass and radius.

**Color.** A Planck spectrum at 3,801 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffcf9b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,801 K and log g 4.82 (u1 0.396, u2 0.350): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
