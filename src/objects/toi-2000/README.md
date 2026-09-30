# TOI-2000

## Sources

Its radius and temperature follow Sha et al. 2023. This account was drafted from Sha et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5244434756689177088, parallax 5.760 ± 0.010 mas (173.60 pc). Radius 1.134 +/- 0.037 solar radii from Sha et al. 2023, the stellar radius of the default parameter set of TOI-2000 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.1113S/abstract). Mass 1.082 +/- 0.059 solar masses from Sha et al. 2023, the stellar mass of the default parameter set of TOI-2000 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.1113S/abstract). Temperature 5,611 K from Sha et al. 2023, the stellar temperature of the default parameter set of TOI-2000 b in the NASA Exoplanet Archive. log g 4.36 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5244434756689177088, through the CIE 1931 2° observer: #ffeade. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,611 K and log g 4.36 (u1 0.495, u2 0.237): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
