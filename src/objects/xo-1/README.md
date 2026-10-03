# Moldoveanu

## Sources

Its radius and temperature follow Stassun et al. 2017. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1316708918505350528, parallax 6.149 ± 0.014 mas (162.63 pc). Radius 0.88 +/- 0.05 solar radii from Stassun et al. 2017, the stellar radius of the default parameter set of XO-1 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Mass 0.88 +/- 0.19 solar masses from Stassun et al. 2017, the stellar mass of the default parameter set of XO-1 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Temperature 5,750 K from Stassun et al. 2017, the stellar temperature of the default parameter set of XO-1 b in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1316708918505350528, through the CIE 1931 2° observer: #fff1eb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,750 K and log g 4.49 (u1 0.465, u2 0.257): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "XO-1" (revision 1374404636) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
