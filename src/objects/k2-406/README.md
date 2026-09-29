# K2-406

## Sources

Its radius and temperature follow Christiansen et al. 2022. This account was drafted from Christiansen et al. 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6214868495365748096, parallax 11.716 ± 0.020 mas (85.35 pc). Radius 0.961 +/- 0.058 solar radii from Christiansen et al. 2022, the stellar radius of the default parameter set of K2-406 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..244C/abstract). Mass 0.798 +/- 0.339 solar masses from Christiansen et al. 2022, the stellar mass of the default parameter set of K2-406 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..244C/abstract). Temperature 5,784 K from Christiansen et al. 2022, the stellar temperature of the default parameter set of K2-406 b in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Colour.** A Planck spectrum at 5,784 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #fff1ea. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,784 K and log g 4.37 (u1 0.456, u2 0.262): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
