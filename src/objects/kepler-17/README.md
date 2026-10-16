# Kepler-17

## Sources

Its radius and temperature follow TICv8. The introduction is generated from TICv8's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2086449761846310784, parallax 1.412 ± 0.015 mas (708.45 pc). Radius 1.01034 solar radii from TICv8, the stellar radius of the default parameter set of Kepler-17 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..138S/abstract). Mass 1.04 solar masses from TICv8, the stellar mass of the default parameter set of Kepler-17 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..138S/abstract). Temperature 5,781 K from TICv8, the stellar temperature of the default parameter set of Kepler-17 b in the NASA Exoplanet Archive. log g 4.45 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2086449761846310784, through the CIE 1931 2° observer: #ffece1. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,781 K and log g 4.45 (u1 0.458, u2 0.261): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-17" (revision 1378458007) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
