# K2-25

## Sources

Its radius and temperature follow Stefansson et al. 2020. This account was drafted from Stefansson et al. 2020's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3311804515502788352, parallax 22.357 ± 0.031 mas (44.73 pc). Radius 0.2932 +/- 0.0093 solar radii from Stefansson et al. 2020, the stellar radius of the default parameter set of K2-25 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..192S/abstract). Mass 0.2634 +/- 0.0077 solar masses from Stefansson et al. 2020, the stellar mass of the default parameter set of K2-25 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..192S/abstract). Temperature 3,207 K from Stefansson et al. 2020, the stellar temperature of the default parameter set of K2-25 b in the NASA Exoplanet Archive. log g 4.92 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3311804515502788352, through the CIE 1931 2° observer: #ffcd83. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,207 K and log g 4.92 (u1 0.155, u2 0.475): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "K2-25" (revision 1370531720), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
