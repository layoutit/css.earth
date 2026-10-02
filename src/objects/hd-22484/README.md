# 10 Tauri

## Sources

Its disc spans 1.081 milliarcseconds, which gives 1.622 solar radii and 5,997 K at its surface. It is also HD 22484, HR 1101, HIP 16852. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3263836568394170880, distance 14 pc from Boyajian et al. (2012), ApJ 746, 101, HD 22484: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 71.6 +/- 0.54 mas, inverted; Gaia DR3's parallax, 71.837 ± 0.150 mas (477.8 standard errors), is not used. Radius 1.622 +/- 0.024 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 22484: radius in solar radii, from the limb-darkened angular diameter 1.081 +/- 0.014 mas (CHARA) and the Hipparcos parallax, 1.622 +/- 0.024 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.139 +/- 0.016 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 22484: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.139 +/- 0.016 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 5,997 K from Boyajian et al. (2012), ApJ 746, 101, HD 22484: effective temperature in K, from the angular diameter and the bolometric flux, 5997 +/- 44. log g 4.07 from the mass and radius.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 22484: 168-1020 nm, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 193: HR 1101; VizieR III/202 (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fefaff. Routes tried in order: gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 1101 is not in the catalogue; kiehling: HR 1101 is not among its 60 stars; burnashev: BS 1101 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,997 K and log g 4.07 (u1 0.412, u2 0.288): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
