# TOI-1518

## Sources

Its radius and temperature follow Simonnin et al. 2025. The introduction is generated from Simonnin et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2210596444367488384, parallax 4.367 ± 0.014 mas (228.98 pc). Radius 1.942 +/- 0.043 solar radii from Simonnin et al. 2025, the stellar radius of the default parameter set of TOI-1518 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...698A.314S/abstract). Mass 1.88 +/- 0.13 solar masses from Simonnin et al. 2025, the stellar mass of the default parameter set of TOI-1518 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...698A.314S/abstract). Temperature 7,299 K from Simonnin et al. 2025, the stellar temperature of the default parameter set of TOI-1518 b in the NASA Exoplanet Archive. log g 4.14 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2210596444367488384, through the CIE 1931 2° observer: #d2dcff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,299 K and log g 4.14 (u1 0.288, u2 0.343): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-1518" (revision 1329937924) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
