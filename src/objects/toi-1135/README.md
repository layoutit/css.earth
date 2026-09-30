# TOI-1135

## Sources

Its radius and temperature follow Dugan et al. 2025. It is also HIP 62908. This account was drafted from Dugan et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1726858366624544640, parallax 8.758 ± 0.011 mas (114.18 pc). Radius 1.202 +/- 0.037 solar radii from Dugan et al. 2025, the stellar radius of the default parameter set of TOI-1135 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJ...994L..23D/abstract). Mass 1.119 +/- 0.069 solar masses from Dugan et al. 2025, the stellar mass of the default parameter set of TOI-1135 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJ...994L..23D/abstract). Temperature 6,320 K from Dugan et al. 2025, the stellar temperature of the default parameter set of TOI-1135 b in the NASA Exoplanet Archive. log g 4.33 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1726858366624544640, through the CIE 1931 2° observer: #fef7ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,320 K and log g 4.33 (u1 0.369, u2 0.308): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
