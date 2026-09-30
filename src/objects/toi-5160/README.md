# TOI-5160

## Sources

Its radius and temperature follow Lafarga et al. 2026. This account was drafted from Lafarga et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 880230839824089600, parallax 6.639 ± 0.021 mas (150.62 pc). Radius 1.03315 solar radii from Lafarga et al. 2026, the stellar radius of the default parameter set of TOI-5160 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.548ag512L/abstract). Mass 0.926 (0.884 to 0.968) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 5,622.14 K from Lafarga et al. 2026, the stellar temperature of the default parameter set of TOI-5160 b in the NASA Exoplanet Archive. log g 4.38 from the mass and radius.

**Colour.** A Planck spectrum at 5,622.14 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffefe5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,622.14 K and log g 4.38 (u1 0.492, u2 0.239): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
