# HD 5015

## Sources

Its disc spans 0.865 milliarcseconds, which gives 1.743 solar radii and 5,963 K at its surface. It is also HR 244, HIP 4151. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 427322415301550208, distance 19 pc from Boyajian et al. (2012), ApJ 746, 101, HD 5015: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 53.35 +/- 0.33 mas, inverted; Gaia DR3's parallax, 52.902 ± 0.104 mas (510.3 standard errors), is not used. Radius 1.743 +/- 0.023 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 5015: radius in solar radii, from the limb-darkened angular diameter 0.865 +/- 0.01 mas (CHARA) and the Hipparcos parallax, 1.743 +/- 0.023 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.182 +/- 0.011 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 5015: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.182 +/- 0.011 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 5,963 K from Boyajian et al. (2012), ApJ 746, 101, HD 5015: effective temperature in K, from the angular diameter and the bolometric flux, 5963 +/- 44. log g 4.03 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 427322415301550208, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 38: HR 244; VizieR III/202 (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #faf5ff. Routes tried in order: stis-ngsl: HD 5015 is not in the library; pulkovo: HR 244 is not in the catalogue; kiehling: HR 244 is not among its 60 stars; burnashev: BS 244 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,963 K and log g 4.03 (u1 0.418, u2 0.284): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
