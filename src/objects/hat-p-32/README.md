# HAT-P-32

## Sources

Its radius and temperature follow Wang et al. 2019. The introduction is generated from Wang et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 356348286886230272, parallax 3.494 ± 0.020 mas (286.22 pc). Radius 1.367 +/- 0.031 solar radii from Wang et al. 2019, the stellar radius of the default parameter set of HAT-P-32 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157...82W/abstract). Mass 1.132 +/- 0.051 solar masses from Wang et al. 2019, the stellar mass of the default parameter set of HAT-P-32 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157...82W/abstract). Temperature 6,001 K from Wang et al. 2019, the stellar temperature of the default parameter set of HAT-P-32 b in the NASA Exoplanet Archive. log g 4.22 from the mass and radius.

**Color.** A Planck spectrum at 6,001 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #fff3f0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,001 K and log g 4.22 (u1 0.413, u2 0.287): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-32b" (revision 1370776745) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
