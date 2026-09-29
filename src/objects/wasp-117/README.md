# WASP-117

## Sources

Its radius and temperature follow Stassun et al. 2017. This account was drafted from Stassun et al. 2017's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4746157737910069888, parallax 6.341 ± 0.013 mas (157.71 pc). Radius 1.22 +/- 0.06 solar radii from Stassun et al. 2017, the stellar radius of the default parameter set of WASP-117 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Mass 1.29 +/- 0.3 solar masses from Stassun et al. 2017, the stellar mass of the default parameter set of WASP-117 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Temperature 6,040 K from Stassun et al. 2017, the stellar temperature of the default parameter set of WASP-117 b in the NASA Exoplanet Archive. log g 4.38 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4746157737910069888, through the CIE 1931 2° observer: #fff7fe. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,040 K and log g 4.38 (u1 0.408, u2 0.289): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
