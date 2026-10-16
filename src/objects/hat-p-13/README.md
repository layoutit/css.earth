# HAT-P-13

## Sources

Its radius follows Bonomo et al. 2017, and its temperature Yalçınkaya et al. 2024. The introduction is generated from Winn et al. 2010's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1014520826353577088, parallax 4.075 ± 0.019 mas (245.40 pc). Radius 1.56 +/- 0.08 solar radii from Bonomo et al. 2017, the stellar radius of HAT-P-13 b's parameter set from Bonomo et al. 2017 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract). Mass 1.22 +/- 0.05 solar masses from Bonomo et al. 2017, the stellar mass of HAT-P-13 b's parameter set from Bonomo et al. 2017 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract). Temperature 5,653 K from Yalçınkaya et al. 2024, the stellar temperature of HAT-P-13 b's parameter set from Yalçınkaya et al. 2024 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.14 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1014520826353577088, through the CIE 1931 2° observer: #ffefe9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,653 K and log g 4.14 (u1 0.482, u2 0.245): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** HAT-P-13 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-13" (revision 1370776705) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
