# Stellio

## Sources

Its disc spans 0.634 milliarcseconds, which gives 2.143 solar radii and 9,131 K at its surface. It is also HD 213558, HR 8585, HIP 111169. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1988193348344678656, distance 31 pc from Boyajian et al. (2012), ApJ 746, 101, HD 213558: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 31.8 +/- 0.12 mas, inverted; Gaia DR3's parallax, 31.494 ± 0.202 mas (156.2 standard errors), is not used. Radius 2.143 +/- 0.074 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 213558: radius in solar radii, from the limb-darkened angular diameter 0.634 +/- 0.022 mas (CHARA) and the Hipparcos parallax, 2.143 +/- 0.074 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 2.209 +/- 0.037 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 213558: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 2.209 +/- 0.037 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 9,131 K from Boyajian et al. (2012), ApJ 746, 101, HD 213558: effective temperature in K, from the angular diameter and the bolometric flux, 9131 +/- 167. log g 4.12 from the mass and radius.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1065: HR 8585; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 547 (BS 8585), the widest of its 2 scans (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #b4cbff. Routes tried in order: stis-ngsl: HD 213558 is not in the library; pulkovo: HR 8585 is not in the catalogue; kiehling: HR 8585 is not among its 60 stars; gaia-xp: found, not needed after the color and its cross-check; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 9,131 K and log g 4.12 (u1 0.268, u2 0.319): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
