# WASP-104

## Sources

Its radius and temperature follow Smith et al. 2014. The introduction is generated from Smith et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3868603216762016256, parallax 5.364 ± 0.019 mas (186.42 pc). Radius 0.963 +/- 0.027 solar radii from Smith et al. 2014, the stellar radius of the default parameter set of WASP-104 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014A&A...570A..64S/abstract). Mass 1.076 +/- 0.049 solar masses from Smith et al. 2014, the stellar mass of the default parameter set of WASP-104 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014A&A...570A..64S/abstract). Temperature 5,475 K from Smith et al. 2014, the stellar temperature of the default parameter set of WASP-104 b in the NASA Exoplanet Archive. log g 4.5 from the mass and radius.

**Color.** A Planck spectrum at 5,475 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffede0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,475 K and log g 4.5 (u1 0.528, u2 0.215): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-104b" (revision 1374244728) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
