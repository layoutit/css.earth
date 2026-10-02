# TOI-270

## Sources

Its radius and temperature follow Kaye et al. 2022. The introduction is generated from Kaye et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4781196115469953024, parallax 44.490 ± 0.015 mas (22.48 pc). Radius 0.38 +/- 0.008 solar radii from Kaye et al. 2022, the stellar radius of the default parameter set of TOI-270 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.510.5464K/abstract). Mass 0.386 +/- 0.008 solar masses from Kaye et al. 2022, the stellar mass of the default parameter set of TOI-270 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.510.5464K/abstract). Temperature 3,506 K from Kaye et al. 2022, the stellar temperature of the default parameter set of TOI-270 b in the NASA Exoplanet Archive. log g 4.87 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4781196115469953024, through the CIE 1931 2° observer: #ffc384. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,506 K and log g 4.87 (u1 0.389, u2 0.381): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-270" (revision 1375755552) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
