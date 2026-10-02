# K2-148

## Sources

Its radius and temperature follow Hirano et al. 2018. The introduction is generated from Hirano et al. 2018's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2536443724641751808, parallax 8.035 ± 0.016 mas (124.46 pc). Radius 0.632 +/- 0.063 solar radii from Hirano et al. 2018, the stellar radius of the default parameter set of K2-148 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....155..127H/abstract). Mass 0.65 +/- 0.061 solar masses from Hirano et al. 2018, the stellar mass of the default parameter set of K2-148 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....155..127H/abstract). Temperature 4,079 K from Hirano et al. 2018, the stellar temperature of the default parameter set of K2-148 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2536443724641751808, through the CIE 1931 2° observer: #ffc095. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,079 K and log g 4.65 (u1 0.608, u2 0.162): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "K2-148b" (revision 1374249256) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
