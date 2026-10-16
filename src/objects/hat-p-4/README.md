# HAT-P-4

## Sources

Its radius and temperature follow Torres et al. 2008. The introduction is generated from Torres et al. 2008's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1291120362349158016, parallax 3.107 ± 0.015 mas (321.84 pc). Radius 1.596 +/- 0.06 solar radii from Torres et al. 2008, the stellar radius of the default parameter set of HAT-P-4 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2008ApJ...677.1324T/abstract). Mass 1.248 +/- 0.07 solar masses from Torres et al. 2008, the stellar mass of the default parameter set of HAT-P-4 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2008ApJ...677.1324T/abstract). Temperature 5,860 K from Torres et al. 2008, the stellar temperature of the default parameter set of HAT-P-4 b in the NASA Exoplanet Archive. log g 4.13 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1291120362349158016, through the CIE 1931 2° observer: #fff4f5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,860 K and log g 4.13 (u1 0.439, u2 0.272): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-4" (revision 1370776753) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
