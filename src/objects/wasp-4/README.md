# WASP-4

## Sources

Its radius follows Baştürk et al. 2025, and its temperature Bouma et al. 2019. The introduction is generated from Baştürk et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6535499658122055552, parallax 3.662 ± 0.015 mas (273.05 pc). Radius 0.912 +/- 0.007 solar radii from Baştürk et al. 2025, the stellar radius of the default parameter set of WASP-4 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025MNRAS.541..714B/abstract). Mass 0.899 +/- 0.033 solar masses from Baştürk et al. 2025, the stellar mass of the default parameter set of WASP-4 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025MNRAS.541..714B/abstract). Temperature 5,400 K from Bouma et al. 2019, the stellar temperature of WASP-4 b's parameter set from Bouma et al. 2019 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.47 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6535499658122055552, through the CIE 1931 2° observer: #ffece1. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,400 K and log g 4.47 (u1 0.547, u2 0.202): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-4" (revision 1374406113) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
