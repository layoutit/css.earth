# TOI-4427

## Sources

Its radius and temperature follow Guenther et al. 2026. This account was drafted from Guenther et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1119137502311125248, parallax 4.957 ± 0.011 mas (201.72 pc). Radius 0.89 +/- 0.03 solar radii from Guenther et al. 2026, the stellar radius of the default parameter set of TOI-4427 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172...54G/abstract). Mass 0.9 +/- 0.03 solar masses from Guenther et al. 2026, the stellar mass of the default parameter set of TOI-4427 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172...54G/abstract). Temperature 5,347 K from Guenther et al. 2026, the stellar temperature of the default parameter set of TOI-4427 b in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1119137502311125248, through the CIE 1931 2° observer: #ffe9da. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,347 K and log g 4.49 (u1 0.561, u2 0.192): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
