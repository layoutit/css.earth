# HAT-P-22

## Sources

Its radius and temperature follow Stassun et al. 2017. It is also HD 233731. This account was drafted from Stassun et al. 2017's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 846946629987527168, parallax 12.273 ± 0.016 mas (81.48 pc). Radius 1.11 +/- 0.05 solar radii from Stassun et al. 2017, the stellar radius of the default parameter set of HAT-P-22 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Mass 1.13 +/- 0.22 solar masses from Stassun et al. 2017, the stellar mass of the default parameter set of HAT-P-22 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Temperature 5,302 K from Stassun et al. 2017, the stellar temperature of the default parameter set of HAT-P-22 b in the NASA Exoplanet Archive. log g 4.4 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 846946629987527168, through the CIE 1931 2° observer: #ffe9dc. Routes tried in order: stis-ngsl: HD 233731 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,302 K and log g 4.4 (u1 0.571, u2 0.185): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "HD 233731" (revision 1357585973), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
