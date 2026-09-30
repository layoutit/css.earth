# TOI-880

## Sources

Its radius and temperature follow Zhang et al. 2025. It is also HD 43629. This account was drafted from Zhang et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2993658970584498048, parallax 16.511 ± 0.014 mas (60.56 pc). Radius 0.83 +/- 0.03 solar radii from Zhang et al. 2025, the stellar radius of the default parameter set of TOI-880.02 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..175Z/abstract). Mass 0.87 +/- 0.03 solar masses from Zhang et al. 2025, the stellar mass of the default parameter set of TOI-880.02 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..175Z/abstract). Temperature 5,050 K from Zhang et al. 2025, the stellar temperature of the default parameter set of TOI-880.02 in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2993658970584498048, through the CIE 1931 2° observer: #ffdeca. Routes tried in order: stis-ngsl: HD 43629 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,050 K and log g 4.54 (u1 0.643, u2 0.131): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
