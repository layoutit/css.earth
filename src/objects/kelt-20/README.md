# KELT-20

## Sources

Its radius and temperature follow Lund et al. 2017. It is also HD 185603, HIP 96618. This account was drafted from Lund et al. 2017's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2033123654092592384, parallax 7.300 ± 0.024 mas (136.98 pc). Radius 1.565 +/- 0.057 solar radii from Lund et al. 2017, the stellar radius of the default parameter set of KELT-20 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....154..194L/abstract). Mass 1.76 +/- 0.14 solar masses from Lund et al. 2017, the stellar mass of the default parameter set of KELT-20 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....154..194L/abstract). Temperature 8,720 K from Lund et al. 2017, the stellar temperature of the default parameter set of KELT-20 b in the NASA Exoplanet Archive. log g 4.29 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2033123654092592384, through the CIE 1931 2° observer: #b8ccff. Routes tried in order: stis-ngsl: HD 185603 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,720 K and log g 4.29 (u1 0.297, u2 0.313): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "KELT-20" (revision 1374447847), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
