# HAT-P-18

## Sources

Its radius and temperature follow TICv8. The introduction is generated from Yee & Vissapragada 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1334573817793362560, parallax 6.186 ± 0.009 mas (161.65 pc). Radius 0.740113 +/- 0.06033 solar radii from TICv8, the stellar radius of HAT-P-18 b's parameter set from TICv8 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..138S/abstract). Mass 0.773 +/- 0.075989 solar masses from TICv8, the stellar mass of HAT-P-18 b's parameter set from TICv8 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..138S/abstract). Temperature 4,790 K from TICv8, the stellar temperature of HAT-P-18 b's parameter set from TICv8 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.59 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1334573817793362560, through the CIE 1931 2° observer: #ffd6ba. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,790 K and log g 4.59 (u1 0.715, u2 0.071): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-18" (revision 1353845600) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
