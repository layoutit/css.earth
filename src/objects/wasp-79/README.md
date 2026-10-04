# Montuno

## Sources

Its radius and temperature follow Gressier et al. 2023. The introduction is generated from Gressier et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4884779765893739904, parallax 4.071 ± 0.015 mas (245.65 pc). Radius 1.51 +/- 0.04 solar radii from Gressier et al. 2023, the stellar radius of the default parameter set of WASP-79 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...672A..34G/abstract). Mass 1.39 +/- 0.06 solar masses from Gressier et al. 2023, the stellar mass of the default parameter set of WASP-79 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...672A..34G/abstract). Temperature 6,600 K from Gressier et al. 2023, the stellar temperature of the default parameter set of WASP-79 b in the NASA Exoplanet Archive. log g 4.22 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4884779765893739904, through the CIE 1931 2° observer: #eaebff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,600 K and log g 4.22 (u1 0.341, u2 0.318): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-79" (revision 1375774697) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
