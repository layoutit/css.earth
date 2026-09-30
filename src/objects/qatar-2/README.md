# Qatar-2

## Sources

Its radius and temperature follow Mancini et al. 2014. The introduction is generated from Mancini et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3620030644476623616, parallax 5.482 ± 0.020 mas (182.40 pc). Radius 0.776 +/- 0.008 solar radii from Mancini et al. 2014, the stellar radius of the default parameter set of Qatar-2 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014MNRAS.443.2391M/abstract). Mass 0.743 +/- 0.021 solar masses from Mancini et al. 2014, the stellar mass of the default parameter set of Qatar-2 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014MNRAS.443.2391M/abstract). Temperature 4,645 K from Mancini et al. 2014, the stellar temperature of the default parameter set of Qatar-2 b in the NASA Exoplanet Archive. log g 4.53 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3620030644476623616, through the CIE 1931 2° observer: #ffcba8. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,645 K and log g 4.53 (u1 0.751, u2 0.041): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Qatar-2" (revision 1374438659) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
