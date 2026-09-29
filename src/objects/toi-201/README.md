# TOI-201

## Sources

Its radius and temperature follow Mireles et al. 2026. It is also HD 39474, HIP 27515. This account was drafted from Mireles et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4767547667180525696, parallax 8.914 ± 0.014 mas (112.18 pc). Radius 1.31 +/- 0.01 solar radii from Mireles et al. 2026, the stellar radius of the default parameter set of TOI-201 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026SciA...12f2618M/abstract). Mass 1.32 +/- 0.02 solar masses from Mireles et al. 2026, the stellar mass of the default parameter set of TOI-201 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026SciA...12f2618M/abstract). Temperature 6,423 K from Mireles et al. 2026, the stellar temperature of the default parameter set of TOI-201 b in the NASA Exoplanet Archive. log g 4.32 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4767547667180525696, through the CIE 1931 2° observer: #f8f4ff. Routes tried in order: stis-ngsl: HD 39474 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,423 K and log g 4.32 (u1 0.358, u2 0.312): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-201 d: Mireles et al. 2026's mass 0.01824884 Jupiter masses in 0.12400771 Jupiter radii is 11.9 g/cm^3, outside what the records accept.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-201" (revision 1374435267), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
