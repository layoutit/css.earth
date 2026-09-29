# TOI-5082

## Sources

Its radius and temperature follow Hord et al. 2024. It is also HD 53532, HIP 34271. This account was drafted from Hord et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3368214650329888512, parallax 23.238 ± 0.026 mas (43.03 pc). Radius 0.93 solar radii from Hord et al. 2024, the stellar radius of the default parameter set of TOI-5082.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..233H/abstract). Mass 0.99665 solar masses from Hord et al. 2024, the stellar mass of the default parameter set of TOI-5082.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..233H/abstract). Temperature 5,670 K from Hord et al. 2024, the stellar temperature of the default parameter set of TOI-5082.01 in the NASA Exoplanet Archive. log g 4.5 from the mass and radius.

**Colour.** A Planck spectrum at 5,670 K, because no archive holds a spectrum of this star (stis-ngsl: HD 53532 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffefe7. Routes tried in order: stis-ngsl: HD 53532 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,670 K and log g 4.5 (u1 0.483, u2 0.245): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
