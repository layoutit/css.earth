# TOI-5300

## Sources

Its radius and temperature follow Frensch et al. 2025. The introduction is generated from Frensch et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2642766361608754432, parallax 6.145 ± 0.017 mas (162.73 pc). Radius 0.65 +/- 0.06 solar radii from Frensch et al. 2025, the stellar radius of the default parameter set of TOI-5300 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...700A.118F/abstract). Mass 0.67 +/- 0.02 solar masses from Frensch et al. 2025, the stellar mass of the default parameter set of TOI-5300 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...700A.118F/abstract). Temperature 4,610 K from Frensch et al. 2025, the stellar temperature of the default parameter set of TOI-5300 b in the NASA Exoplanet Archive. log g 4.64 from the mass and radius.

**Color.** A Planck spectrum at 4,610 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe0c0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,610 K and log g 4.64 (u1 0.753, u2 0.038): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
