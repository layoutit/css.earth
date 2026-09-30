# NGTS-11

## Sources

Its radius and temperature follow Gill et al. 2020. This account was drafted from Gill et al. 2020's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2453680078509741056, parallax 5.294 ± 0.018 mas (188.88 pc). Radius 0.832 +/- 0.013 solar radii from Gill et al. 2020, the stellar radius of the default parameter set of NGTS-11 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract). Mass 0.862 +/- 0.028 solar masses from Gill et al. 2020, the stellar mass of the default parameter set of NGTS-11 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract). Temperature 5,050 K from Gill et al. 2020, the stellar temperature of the default parameter set of NGTS-11 b in the NASA Exoplanet Archive. log g 4.53 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2453680078509741056, through the CIE 1931 2° observer: #ffe1cc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,050 K and log g 4.53 (u1 0.643, u2 0.131): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
