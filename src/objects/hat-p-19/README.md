# HAT-P-19

## Sources

Its radius and temperature follow Kang et al. 2024. The introduction is generated from Kang et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 365426679516816512, parallax 4.957 ± 0.014 mas (201.75 pc). Radius 0.773 +/- 0.011 solar radii from Kang et al. 2024, the stellar radius of the default parameter set of HAT-P-19 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.528.1930K/abstract). Mass 0.807 +/- 0.034 solar masses from Kang et al. 2024, the stellar mass of the default parameter set of HAT-P-19 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.528.1930K/abstract). Temperature 4,962 K from Kang et al. 2024, the stellar temperature of the default parameter set of HAT-P-19 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 365426679516816512, through the CIE 1931 2° observer: #ffdac0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,962 K and log g 4.57 (u1 0.668, u2 0.111): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-19" (revision 1353845700) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
