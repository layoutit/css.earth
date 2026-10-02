# WASP-33

## Sources

Its radius and temperature follow Chakrabarty & Sengupta 2019. It is also HD 15082, HIP 11397. The introduction is generated from Chakrabarty & Sengupta 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 328636019723252096, parallax 8.224 ± 0.033 mas (121.60 pc). Radius 1.444 +/- 0.034 solar radii from Chakrabarty & Sengupta 2019, the stellar radius of the default parameter set of WASP-33 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract). Mass 1.495 +/- 0.031 solar masses from Chakrabarty & Sengupta 2019, the stellar mass of the default parameter set of WASP-33 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract). Temperature 7,430 K from Chakrabarty & Sengupta 2019, the stellar temperature of the default parameter set of WASP-33 b in the NASA Exoplanet Archive. log g 4.29 from the mass and radius.

**Color.** A Planck spectrum at 7,430 K, because no archive holds a spectrum of this star (stis-ngsl: HD 15082 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ecedff. Routes tried in order: stis-ngsl: HD 15082 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,430 K and log g 4.29 (u1 0.280, u2 0.347): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 15082" (revision 1370777457) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
