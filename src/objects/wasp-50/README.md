# WASP-50

## Sources

Its radius and temperature follow Chakrabarty & Sengupta 2019. This account was drafted from Chakrabarty & Sengupta 2019's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5160557726183065984, parallax 5.486 ± 0.017 mas (182.27 pc). Radius 0.843 +/- 0.031 solar radii from Chakrabarty & Sengupta 2019, the stellar radius of the default parameter set of WASP-50 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract). Mass 0.892 +/- 0.08 solar masses from Chakrabarty & Sengupta 2019, the stellar mass of the default parameter set of WASP-50 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract). Temperature 5,400 K from Chakrabarty & Sengupta 2019, the stellar temperature of the default parameter set of WASP-50 b in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5160557726183065984, through the CIE 1931 2° observer: #ffebde. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,400 K and log g 4.54 (u1 0.547, u2 0.202): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "WASP-50" (revision 1374406429), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
