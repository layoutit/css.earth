# TOI-6894

## Sources

Its radius and temperature follow Bryant et al. 2025. The introduction is generated from Bryant et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3917278287286247808, parallax 13.684 ± 0.053 mas (73.08 pc). Radius 0.2276 +/- 0.0057 solar radii from Bryant et al. 2025, the stellar radius of the default parameter set of TOI-6894 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025NatAs...9.1031B/abstract). Mass 0.207 +/- 0.011 solar masses from Bryant et al. 2025, the stellar mass of the default parameter set of TOI-6894 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025NatAs...9.1031B/abstract). Temperature 3,007 K from Bryant et al. 2025, the stellar temperature of the default parameter set of TOI-6894 b in the NASA Exoplanet Archive. log g 5.04 from the mass and radius.

**Colour.** A Planck spectrum at 3,007 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffb86e. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,007 K and log g 5.04 (u1 0.181, u2 0.518): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-6894" (revision 1357019233) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
