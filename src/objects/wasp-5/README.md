# WASP-5

## Sources

Its radius and temperature follow Gillon et al. 2009. The introduction is generated from Gillon et al. 2009's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6533307957785865856, parallax 3.188 ± 0.015 mas (313.65 pc). Radius 1.029 +/- 0.056 solar radii from Gillon et al. 2009, the stellar radius of the default parameter set of WASP-5 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2009A&A...496..259G/abstract). Mass 0.96 +/- 0.13 solar masses from Gillon et al. 2009, the stellar mass of the default parameter set of WASP-5 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2009A&A...496..259G/abstract). Temperature 5,700 K from Gillon et al. 2009, the stellar temperature of the default parameter set of WASP-5 b in the NASA Exoplanet Archive. log g 4.4 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6533307957785865856, through the CIE 1931 2° observer: #fff0eb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,700 K and log g 4.4 (u1 0.475, u2 0.250): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-5" (revision 1374405504) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
