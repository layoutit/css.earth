# TOI-251

## Sources

Its radius and temperature follow Zhou et al. 2021. This account was drafted from Zhou et al. 2021's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6539037542941988736, parallax 9.901 ± 0.014 mas (101.00 pc). Radius 0.881 +/- 0.038 solar radii from Zhou et al. 2021, the stellar radius of the default parameter set of TOI-251 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161....2Z/abstract). Mass 1.036 +/- 0.013 solar masses from Zhou et al. 2021, the stellar mass of the default parameter set of TOI-251 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161....2Z/abstract). Temperature 5,875 K from Zhou et al. 2021, the stellar temperature of the default parameter set of TOI-251 b in the NASA Exoplanet Archive. log g 4.56 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 6539037542941988736, through the CIE 1931 2° observer: #fff3f3. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,875 K and log g 4.56 (u1 0.440, u2 0.271): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
