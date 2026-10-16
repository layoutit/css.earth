# HAT-P-16

## Sources

Its radius follows Bonomo et al. 2017, and its temperature Yalçınkaya et al. 2024. The introduction is generated from Alexoudi 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 381592313648387200, parallax 4.496 ± 0.015 mas (222.43 pc). Radius 1.237 +/- 0.054 solar radii from Bonomo et al. 2017, the stellar radius of HAT-P-16 b's parameter set from Bonomo et al. 2017 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract). Mass 1.218 +/- 0.039 solar masses from Bonomo et al. 2017, the stellar mass of HAT-P-16 b's parameter set from Bonomo et al. 2017 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract). Temperature 6,158 K from Yalçınkaya et al. 2024, the stellar temperature of HAT-P-16 b's parameter set from Yalçınkaya et al. 2024 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.34 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 381592313648387200, through the CIE 1931 2° observer: #fff7fe. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,158 K and log g 4.34 (u1 0.390, u2 0.298): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-16" (revision 1370776712) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
