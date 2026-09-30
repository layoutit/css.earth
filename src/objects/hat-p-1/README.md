# HAT-P-1

## Sources

Its radius and temperature follow Nikolov et al. 2014. The introduction is generated from Nikolov et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1928431764627661440, parallax 6.244 ± 0.015 mas (160.16 pc). Radius 1.174 +/- 0.026 solar radii from Nikolov et al. 2014, the stellar radius of the default parameter set of HAT-P-1 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014MNRAS.437...46N/abstract). Mass 1.151 +/- 0.052 solar masses from Nikolov et al. 2014, the stellar mass of the default parameter set of HAT-P-1 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014MNRAS.437...46N/abstract). Temperature 5,980 K from Nikolov et al. 2014, the stellar temperature of the default parameter set of HAT-P-1 b in the NASA Exoplanet Archive. log g 4.36 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1928431764627661440, through the CIE 1931 2° observer: #fff4f6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,980 K and log g 4.36 (u1 0.418, u2 0.284): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "ADS 16402" (revision 1369429338) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
