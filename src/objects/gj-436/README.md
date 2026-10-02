# GJ 436

## Sources

Its radius follows Maciejewski et al. 2014, and its temperature Maxted et al. 2022. It is also HIP 57087. The introduction is generated from Maciejewski et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4017860992519744384, parallax 102.301 ± 0.030 mas (9.78 pc). Radius 0.455 +/- 0.018 solar radii from Maciejewski et al. 2014, the stellar radius of the default parameter set of GJ 436 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014AcA....64..323M/abstract). Mass 0.47 +/- 0.07 solar masses from Maciejewski et al. 2014, the stellar mass of the default parameter set of GJ 436 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014AcA....64..323M/abstract). Temperature 3,505 K from Maxted et al. 2022, the stellar temperature of GJ 436 b's parameter set from Maxted et al. 2022 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.79 from the mass and radius.

**Color.** A Planck spectrum at 3,505 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc78c. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,505 K and log g 4.79 (u1 0.400, u2 0.373): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Gliese 436" (revision 1370776305) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
