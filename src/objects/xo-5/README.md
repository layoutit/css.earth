# Absolutno

## Sources

Its radius and temperature follow Smith 2015. The introduction is generated from Smith 2015's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 920308932010648448, parallax 3.652 ± 0.017 mas (273.84 pc). Radius 1.13 +/- 0.03 solar radii from Smith 2015, the stellar radius of the default parameter set of XO-5 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015AcA....65..117S/abstract). Mass 1.04 +/- 0.03 solar masses from Smith 2015, the stellar mass of the default parameter set of XO-5 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015AcA....65..117S/abstract). Temperature 5,430 K from Smith 2015, the stellar temperature of the default parameter set of XO-5 b in the NASA Exoplanet Archive. log g 4.35 from the mass and radius.

**Color.** A Planck spectrum at 5,430 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffecdf. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,430 K and log g 4.35 (u1 0.538, u2 0.208): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "XO-5" (revision 1374514051) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
