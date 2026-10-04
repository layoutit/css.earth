# Tevel

## Sources

Its radius and temperature follow Wang et al. 2019. The introduction is generated from Wang et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 898130030131443584, parallax 2.163 ± 0.014 mas (462.41 pc). Radius 1.338 +/- 0.065 solar radii from Wang et al. 2019, the stellar radius of the default parameter set of HAT-P-9 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157...82W/abstract). Mass 1.281 +/- 0.057 solar masses from Wang et al. 2019, the stellar mass of the default parameter set of HAT-P-9 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157...82W/abstract). Temperature 6,350 K from Wang et al. 2019, the stellar temperature of the default parameter set of HAT-P-9 b in the NASA Exoplanet Archive. log g 4.29 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 898130030131443584, through the CIE 1931 2° observer: #fcf6ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,350 K and log g 4.29 (u1 0.366, u2 0.309): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-9" (revision 1370776780) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
