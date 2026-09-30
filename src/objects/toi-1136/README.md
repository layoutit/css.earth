# TOI-1136

## Sources

Its radius and temperature follow Dai et al. 2023. The introduction is generated from Dai et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1677343097418015488, parallax 11.824 ± 0.011 mas (84.58 pc). Radius 0.968 +/- 0.036 solar radii from Dai et al. 2023, the stellar radius of the default parameter set of TOI-1136 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165...33D/abstract). Mass 1.022 +/- 0.027 solar masses from Dai et al. 2023, the stellar mass of the default parameter set of TOI-1136 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165...33D/abstract). Temperature 5,770 K from Dai et al. 2023, the stellar temperature of the default parameter set of TOI-1136 b in the NASA Exoplanet Archive. log g 4.48 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1677343097418015488, through the CIE 1931 2° observer: #fff3f3. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,770 K and log g 4.48 (u1 0.461, u2 0.259): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-1136" (revision 1373175479) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
