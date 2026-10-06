# b Aquilae

## Sources

Its disc spans 0.845 milliarcseconds, which gives 1.379 solar radii and 5,787 K at its surface. It is also HD 182572, HR 7373, HIP 95447. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4315804351350378496, distance 15 pc from Boyajian et al. (2012), ApJ 746, 101, HD 182572: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 65.89 +/- 0.26 mas, inverted; Gaia DR3's parallax, 67.015 ± 0.066 mas (1020.7 standard errors), is not used. Radius 1.379 +/- 0.042 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 182572: radius in solar radii, from the limb-darkened angular diameter 0.845 +/- 0.025 mas (CHARA) and the Hipparcos parallax, 1.379 +/- 0.042 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.186 +/- 0.015 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 182572: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.186 +/- 0.015 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 5,787 K from Boyajian et al. (2012), ApJ 746, 101, HD 182572: effective temperature in K, from the angular diameter and the bolometric flux, 5787 +/- 92. log g 4.23 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4315804351350378496, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 857: HR 7373; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffefe8. Routes tried in order: stis-ngsl: HD 182572 is not in the library; pulkovo: HR 7373 is not in the catalogue; kiehling: HR 7373 is not among its 60 stars; burnashev: BS 7373 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,787 K and log g 4.23 (u1 0.454, u2 0.263): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
