# WASP-123

## Sources

Its radius and temperature follow Turner et al. 2016. This account was drafted from Alexoudi 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6756148659453907200, parallax 5.009 ± 0.020 mas (199.65 pc). Radius 1.285 +/- 0.051 solar radii from Turner et al. 2016, the stellar radius of WASP-123 b's parameter set from Turner et al. 2016 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016PASP..128f4401T/abstract). Mass 1.166 +/- 0.061 solar masses from Turner et al. 2016, the stellar mass of WASP-123 b's parameter set from Turner et al. 2016 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016PASP..128f4401T/abstract). Temperature 5,740 K from Turner et al. 2016, the stellar temperature of WASP-123 b's parameter set from Turner et al. 2016 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.29 from the mass and radius.

**Colour.** A Planck spectrum at 5,740 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #fff0e9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,740 K and log g 4.29 (u1 0.464, u2 0.257): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
