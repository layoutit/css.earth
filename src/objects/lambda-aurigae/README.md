# Lambda Aurigae

## Sources

Its disc spans 0.981 milliarcseconds, which gives 1.331 solar radii and 5,749 K at its surface. It is also HD 34411, HR 1729, HIP 24813. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 188771135583573504, distance 13 pc from Boyajian et al. (2012), ApJ 746, 101, HD 34411: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 79.18 +/- 0.28 mas, inverted; Gaia DR3's parallax, 79.602 ± 0.100 mas (792.4 standard errors), is not used. Radius 1.331 +/- 0.021 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 34411: radius in solar radii, from the limb-darkened angular diameter 0.981 +/- 0.015 mas (CHARA) and the Hipparcos parallax, 1.331 +/- 0.021 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.041 +/- 0.015 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 34411: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.041 +/- 0.015 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 5,749 K from Boyajian et al. (2012), ApJ 746, 101, HD 34411: effective temperature in K, from the angular diameter and the bolometric flux, 5749 +/- 48. log g 4.21 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 188771135583573504, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 344: HR 1729; VizieR III/202 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fff6fa. Routes tried in order: stis-ngsl: HD 34411 is not in the library; pulkovo: HR 1729 is not in the catalogue; kiehling: HR 1729 is not among its 60 stars; burnashev: BS 1729 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,749 K and log g 4.21 (u1 0.461, u2 0.259): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
