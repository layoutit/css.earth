# WASP-7

## Sources

Its radius and temperature follow Southworth et al. 2011. It is also HD 197286. This account was drafted from Southworth et al. 2011's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6681720724498802176, parallax 6.190 ± 0.018 mas (161.55 pc). Radius 1.432 +/- 0.092 solar radii from Southworth et al. 2011, the stellar radius of the default parameter set of WASP-7 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2011A&A...527A...8S/abstract). Mass 1.276 +/- 0.065 solar masses from Southworth et al. 2011, the stellar mass of the default parameter set of WASP-7 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2011A&A...527A...8S/abstract). Temperature 6,400 K from Southworth et al. 2011, the stellar temperature of the default parameter set of WASP-7 b in the NASA Exoplanet Archive. log g 4.23 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 6681720724498802176, through the CIE 1931 2° observer: #efeeff. Routes tried in order: stis-ngsl: HD 197286 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,400 K and log g 4.23 (u1 0.361, u2 0.311): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "WASP-7" (revision 1374434258), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
