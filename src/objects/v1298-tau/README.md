# V1298 Tau

## Sources

Its radius and temperature follow Livingston et al. 2026. The introduction is generated from Livingston et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 51886335968692480, parallax 9.258 ± 0.020 mas (108.02 pc). Radius 1.32 +/- 0.05 solar radii from Livingston et al. 2026, the stellar radius of the default parameter set of V1298 Tau c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026Natur.649..310L/abstract). Mass 1.1 +/- 0.05 solar masses from Livingston et al. 2026, the stellar mass of the default parameter set of V1298 Tau c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026Natur.649..310L/abstract). Temperature 4,970 K from Livingston et al. 2026, the stellar temperature of the default parameter set of V1298 Tau c in the NASA Exoplanet Archive. log g 4.24 from the mass and radius.

**Color.** A Planck spectrum at 4,970 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,970 K and log g 4.24 (u1 0.661, u2 0.118): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** V1298 Tau b: Livingston et al. 2026's mass 0.04121721 Jupiter masses in 0.83950542 Jupiter radii is 0.1 g/cm^3, outside what the records accept.
- **Not shown.** V1298 Tau e: Livingston et al. 2026's mass 0.04813918 Jupiter masses in 0.90730819 Jupiter radii is 0.1 g/cm^3, outside what the records accept.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "V1298 Tauri" (revision 1370790833) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
