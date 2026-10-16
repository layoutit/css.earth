# WASP-46

## Sources

Its radius and temperature follow Ciceri et al. 2016. The introduction is generated from Ciceri et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6462994429708755072, parallax 2.688 ± 0.013 mas (372.05 pc). Radius 0.858 +/- 0.027 solar radii from Ciceri et al. 2016, the stellar radius of the default parameter set of WASP-46 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016MNRAS.456..990C/abstract). Mass 0.828 +/- 0.076 solar masses from Ciceri et al. 2016, the stellar mass of the default parameter set of WASP-46 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016MNRAS.456..990C/abstract). Temperature 5,600 K from Ciceri et al. 2016, the stellar temperature of the default parameter set of WASP-46 b in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6462994429708755072, through the CIE 1931 2° observer: #fff2ed. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,600 K and log g 4.49 (u1 0.499, u2 0.235): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-46" (revision 1374405948) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
