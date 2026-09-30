# K2-32

## Sources

Its radius and temperature follow Lillo-Box et al. 2020. The introduction is generated from Lillo-Box et al. 2020's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4130539180358512768, parallax 6.394 ± 0.015 mas (156.40 pc). Radius 0.86 +/- 0.02 solar radii from Lillo-Box et al. 2020, the stellar radius of the default parameter set of K2-32 e in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...640A..48L/abstract). Mass 0.83 +/- 0.02 solar masses from Lillo-Box et al. 2020, the stellar mass of the default parameter set of K2-32 e in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...640A..48L/abstract). Temperature 5,271 K from Lillo-Box et al. 2020, the stellar temperature of the default parameter set of K2-32 e in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4130539180358512768, through the CIE 1931 2° observer: #ffdec4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,271 K and log g 4.49 (u1 0.580, u2 0.178): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "K2-32" (revision 1374406472) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
