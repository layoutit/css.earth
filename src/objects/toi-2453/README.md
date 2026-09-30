# TOI-2453

## Sources

Its radius and temperature follow Lafarga et al. 2026. This account was drafted from Lafarga et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3295485490907597696, parallax 12.181 ± 0.017 mas (82.09 pc). Radius 0.502498 solar radii from Lafarga et al. 2026, the stellar radius of the default parameter set of TOI-2453 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.548ag512L/abstract). Mass 0.549 (0.509 to 0.589) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 3,720.23 K from Lafarga et al. 2026, the stellar temperature of the default parameter set of TOI-2453 b in the NASA Exoplanet Archive. log g 4.78 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3295485490907597696, through the CIE 1931 2° observer: #ffc388. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,720.23 K and log g 4.78 (u1 0.386, u2 0.365): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
