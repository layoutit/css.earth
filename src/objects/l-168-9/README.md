# Danfeng

## Sources

Its radius and temperature follow Hobson et al. 2024. It is also HIP 115211. The introduction is generated from Hobson et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6491962300492857472, parallax 39.711 ± 0.024 mas (25.18 pc). Radius 0.604 +/- 0.037 solar radii from Hobson et al. 2024, the stellar radius of the default parameter set of L 168-9 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...688A.216H/abstract). Mass 0.614 +/- 0.055 solar masses from Hobson et al. 2024, the stellar mass of the default parameter set of L 168-9 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...688A.216H/abstract). Temperature 3,842 K from Hobson et al. 2024, the stellar temperature of the default parameter set of L 168-9 b in the NASA Exoplanet Archive. log g 4.66 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6491962300492857472, through the CIE 1931 2° observer: #ffbf8b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,842 K and log g 4.66 (u1 0.462, u2 0.295): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "L 168-9" (revision 1374441655) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
