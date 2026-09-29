# TOI-4641

## Sources

Its radius and temperature follow Bieryla et al. 2024. It is also HD 17607, HIP 13224. This account was drafted from Bieryla et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 114340658009875072, parallax 11.409 ± 0.026 mas (87.65 pc). Radius 1.72 +/- 0.041 solar radii from Bieryla et al. 2024, the stellar radius of the default parameter set of TOI-4641 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.52710955B/abstract). Mass 1.41 +/- 0.068 solar masses from Bieryla et al. 2024, the stellar mass of the default parameter set of TOI-4641 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.52710955B/abstract). Temperature 6,560 K from Bieryla et al. 2024, the stellar temperature of the default parameter set of TOI-4641 b in the NASA Exoplanet Archive. log g 4.12 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 114340658009875072, through the CIE 1931 2° observer: #e3e6ff. Routes tried in order: stis-ngsl: HD 17607 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,560 K and log g 4.12 (u1 0.345, u2 0.316): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
