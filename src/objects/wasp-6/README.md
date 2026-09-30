# WASP-6

## Sources

Its radius and temperature follow McGruder et al. 2023. This account was drafted from McGruder et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2385171398768647552, parallax 5.007 ± 0.013 mas (199.71 pc). Radius 0.79 +/- 0.008 solar radii from McGruder et al. 2023, the stellar radius of the default parameter set of WASP-6 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023ApJ...944L..56M/abstract). Mass 0.854 +/- 0.027 solar masses from McGruder et al. 2023, the stellar mass of the default parameter set of WASP-6 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023ApJ...944L..56M/abstract). Temperature 5,438 K from McGruder et al. 2023, the stellar temperature of the default parameter set of WASP-6 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2385171398768647552, through the CIE 1931 2° observer: #ffece0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,438 K and log g 4.57 (u1 0.538, u2 0.208): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "WASP-6" (revision 1374406293), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
