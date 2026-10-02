# Chara

## Sources

Its disc spans 1.238 milliarcseconds, which gives 1.123 solar radii and 5,653 K at its surface. It is also HD 109358, HR 4785, HIP 61317. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1534011998572555776, distance 8 pc from Boyajian et al. (2012), ApJ 746, 101, HD 109358: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 118.49 +/- 0.2 mas, inverted; Gaia DR3's parallax, 118.027 ± 0.153 mas (771.3 standard errors), is not used. Radius 1.123 +/- 0.028 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 109358: radius in solar radii, from the limb-darkened angular diameter 1.238 +/- 0.03 mas (CHARA) and the Hipparcos parallax, 1.123 +/- 0.028 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 0.852 +/- 0.023 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 109358: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 0.852 +/- 0.023 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 5,653 K from Boyajian et al. (2012), ApJ 746, 101, HD 109358: effective temperature in K, from the angular diameter and the bolometric flux, 5653 +/- 72. log g 4.27 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1534011998572555776, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 621: HR 4785; VizieR III/202 (2 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fff8fd. Routes tried in order: stis-ngsl: HD 109358 is not in the library; pulkovo: HR 4785 is not in the catalogue; kiehling: HR 4785 is not among its 60 stars; burnashev: BS 4785 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,653 K and log g 4.27 (u1 0.484, u2 0.244): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 2 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
