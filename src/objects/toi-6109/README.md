# TOI-6109

## Sources

Its radius and temperature follow Dattilo et al. 2025. This account was drafted from Dattilo et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 241035596174886016, parallax 6.734 ± 0.018 mas (148.51 pc). Radius 1.021 +/- 0.038 solar radii from Dattilo et al. 2025, the stellar radius of the default parameter set of TOI-6109 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..318D/abstract). Mass 1.03 +/- 0.05 solar masses from Dattilo et al. 2025, the stellar mass of the default parameter set of TOI-6109 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..318D/abstract). Temperature 5,660 K from Dattilo et al. 2025, the stellar temperature of the default parameter set of TOI-6109 b in the NASA Exoplanet Archive. log g 4.43 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 241035596174886016, through the CIE 1931 2° observer: #ffefe9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,660 K and log g 4.43 (u1 0.484, u2 0.244): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
