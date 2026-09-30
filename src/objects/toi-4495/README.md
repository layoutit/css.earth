# TOI-4495

## Sources

Its radius and temperature follow Wang et al. 2026. This account was drafted from Wang et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2099011888349441536, parallax 7.588 ± 0.012 mas (131.78 pc). Radius 1.309 +/- 0.059 solar radii from Wang et al. 2026, the stellar radius of the default parameter set of TOI-4495 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....171..135W/abstract). Mass 1.247 +/- 0.045 solar masses from Wang et al. 2026, the stellar mass of the default parameter set of TOI-4495 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....171..135W/abstract). Temperature 6,210 K from Wang et al. 2026, the stellar temperature of the default parameter set of TOI-4495 b in the NASA Exoplanet Archive. log g 4.3 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2099011888349441536, through the CIE 1931 2° observer: #fef7ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,210 K and log g 4.3 (u1 0.382, u2 0.302): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
