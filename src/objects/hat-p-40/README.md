# Taika

## Sources

Its radius and temperature follow Stassun et al. 2017. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1962153854973972096, parallax 2.053 ± 0.017 mas (486.99 pc). Radius 1.94 +/- 0.22 solar radii from Stassun et al. 2017, the stellar radius of the default parameter set of HAT-P-40 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Mass 1.03 +/- 0.4 solar masses from Stassun et al. 2017, the stellar mass of the default parameter set of HAT-P-40 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Temperature 6,080 K from Stassun et al. 2017, the stellar temperature of the default parameter set of HAT-P-40 b in the NASA Exoplanet Archive. log g 3.88 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1962153854973972096, through the CIE 1931 2° observer: #fff2ef. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,080 K and log g 3.88 (u1 0.399, u2 0.294): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
