# HAT-P-2

## Sources

Its radius and temperature follow Ment et al. 2018. It is also HD 147506, HIP 80076. The introduction is generated from Ment et al. 2018's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1380825667768742144, parallax 7.781 ± 0.012 mas (128.52 pc). Radius 1.39 +/- 0.09 solar radii from Ment et al. 2018, the stellar radius of the default parameter set of HAT-P-2 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156..213M/abstract). Mass 1.33 +/- 0.03 solar masses from Ment et al. 2018, the stellar mass of the default parameter set of HAT-P-2 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156..213M/abstract). Temperature 6,380 K from Ment et al. 2018, the stellar temperature of the default parameter set of HAT-P-2 b in the NASA Exoplanet Archive. log g 4.28 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1380825667768742144, through the CIE 1931 2° observer: #efeeff. Routes tried in order: stis-ngsl: HD 147506 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,380 K and log g 4.28 (u1 0.363, u2 0.310): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** HAT-P-2 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 147506" (revision 1374435590) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
