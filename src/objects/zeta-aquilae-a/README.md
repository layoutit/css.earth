# Zeta Aquilae A

## Sources

Its disc spans 0.895 milliarcseconds, which gives 2.449 solar radii and 9,205 K at its surface. It is also HD 177724, HR 7235, HIP 93747. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4314399312979641728, distance 25 pc from Boyajian et al. (2012), ApJ 746, 101, HD 177724: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 39.27 +/- 0.17 mas, inverted; Gaia DR3's parallax, 38.233 ± 0.349 mas (109.5 standard errors), is not used. Radius 2.449 +/- 0.046 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 177724: radius in solar radii, from the limb-darkened angular diameter 0.895 +/- 0.017 mas (CHARA) and the Hipparcos parallax, 2.449 +/- 0.046 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.984 +/- 0.006 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 177724: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.984 +/- 0.006 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 9,205 K from Boyajian et al. (2012), ApJ 746, 101, HD 177724: effective temperature in K, from the angular diameter and the bolometric flux, 9205 +/- 95. log g 3.96 from the mass and radius.

**Colour.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 834: HR 7235; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 4314399312979641728 (16 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #b8cbff. Routes tried in order: stis-ngsl: HD 177724 is not in the library; pulkovo: HR 7235 is not in the catalogue; kiehling: HR 7235 is not among its 60 stars; burnashev: BS 7235 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 9,205 K and log g 3.96 (u1 0.262, u2 0.321): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 16 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
