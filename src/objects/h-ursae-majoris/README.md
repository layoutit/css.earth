# h Ursae Majoris

## Sources

Its disc spans 1.133 milliarcseconds, which gives 2.902 solar radii and 6,693 K at its surface. It is also HD 81937, HR 3757, HIP 46733. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1064092789129355136, distance 24 pc from Boyajian et al. (2012), ApJ 746, 101, HD 81937: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 41.99 +/- 0.16 mas, inverted; Gaia DR3's parallax, 42.090 ± 0.162 mas (260.4 standard errors), is not used. Radius 2.902 +/- 0.026 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 81937: radius in solar radii, from the limb-darkened angular diameter 1.133 +/- 0.009 mas (CHARA) and the Hipparcos parallax, 2.902 +/- 0.026 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.824 +/- 0.016 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 81937: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.824 +/- 0.016 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,693 K from Boyajian et al. (2012), ApJ 746, 101, HD 81937: effective temperature in K, from the angular diameter and the bolometric flux, 6693 +/- 45. log g 3.77 from the mass and radius.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 539: HR 3757; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 1064092789129355136 (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #dee4ff. Routes tried in order: stis-ngsl: HD 81937 is not in the library; pulkovo: HR 3757 is not in the catalogue; kiehling: HR 3757 is not among its 60 stars; burnashev: BS 3757 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,693 K and log g 3.77 (u1 0.334, u2 0.321): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
