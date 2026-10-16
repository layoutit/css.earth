# WASP-28

## Sources

Its radius follows Mo&#x10D;nik et al. 2020, and its temperature Bonomo et al. 2017. The introduction is generated from Mo&#x10D;nik et al. 2020's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2641087471777046016, parallax 2.922 ± 0.015 mas (342.29 pc). Radius 1.083 +/- 0.025 solar radii from Mo&#x10D;nik et al. 2020, the stellar radius of the default parameter set of WASP-28 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020PASP..132a4401M/abstract). Mass 0.993 +/- 0.067 solar masses from Mo&#x10D;nik et al. 2020, the stellar mass of the default parameter set of WASP-28 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020PASP..132a4401M/abstract). Temperature 6,150 K from Bonomo et al. 2017, the stellar temperature of WASP-28 b's parameter set from Bonomo et al. 2017 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Color.** A Planck spectrum at 6,150 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #fff5f5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,150 K and log g 4.37 (u1 0.392, u2 0.298): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-28" (revision 1374435559) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
