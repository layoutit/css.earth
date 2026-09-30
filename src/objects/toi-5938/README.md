# TOI-5938

## Sources

Its radius and temperature follow Morello et al. 2026. This account was drafted from Morello et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1837141272694055168, parallax 8.809 ± 0.011 mas (113.52 pc). Radius 0.712 +/- 0.018 solar radii from Morello et al. 2026, the stellar radius of the default parameter set of TOI-5938 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549ag183M/abstract). Mass 0.744 +/- 0.016 solar masses from Morello et al. 2026, the stellar mass of the default parameter set of TOI-5938 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549ag183M/abstract). Temperature 4,650 K from Morello et al. 2026, the stellar temperature of the default parameter set of TOI-5938 b in the NASA Exoplanet Archive. log g 4.6 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1837141272694055168, through the CIE 1931 2° observer: #ffcbaa. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,650 K and log g 4.6 (u1 0.747, u2 0.044): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
