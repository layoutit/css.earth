# TOI-5734

## Sources

Its radius and temperature follow Filomeno et al. 2026. The introduction is generated from Filomeno et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 898844639674672640, parallax 30.703 ± 0.018 mas (32.57 pc). Radius 0.639 +/- 0.034 solar radii from Filomeno et al. 2026, the stellar radius of the default parameter set of TOI-5734 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...708A..90F/abstract). Mass 0.724 +/- 0.009 solar masses from Filomeno et al. 2026, the stellar mass of the default parameter set of TOI-5734 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...708A..90F/abstract). Temperature 4,750 K from Filomeno et al. 2026, the stellar temperature of the default parameter set of TOI-5734 b in the NASA Exoplanet Archive. log g 4.69 from the mass and radius.

**Colour.** A Planck spectrum at 4,750 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,750 K and log g 4.69 (u1 0.726, u2 0.061): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
