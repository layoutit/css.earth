# K2-33

## Sources

Its radius and temperature follow Mann et al. 2016. The introduction is generated from Mann et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6245758900889486720, parallax 7.193 ± 0.023 mas (139.03 pc). Radius 1.05 +/- 0.07 solar radii from Mann et al. 2016, the stellar radius of the default parameter set of K2-33 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....152...61M/abstract). Mass 0.56 +/- 0.09 solar masses from Mann et al. 2016, the stellar mass of the default parameter set of K2-33 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....152...61M/abstract). Temperature 3,540 K from Mann et al. 2016, the stellar temperature of the default parameter set of K2-33 b in the NASA Exoplanet Archive. log g 4.14 from the mass and radius.

**Color.** A Planck spectrum at 3,540 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc88d. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,540 K and log g 4.14 (u1 0.540, u2 0.258): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "K2-33" (revision 1366881676) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
