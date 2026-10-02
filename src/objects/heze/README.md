# Heze

## Sources

Its disc spans 0.852 milliarcseconds, which gives 2.079 solar radii and 8,247 K at its surface. It is also HD 118098, HR 5107, HIP 66249. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3662636823132300032, distance 23 pc from Boyajian et al. (2012), ApJ 746, 101, HD 118098: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 44.01 +/- 0.19 mas, inverted; Gaia DR3's parallax, 43.747 ± 0.333 mas (131.4 standard errors), is not used. Radius 2.079 +/- 0.025 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 118098: radius in solar radii, from the limb-darkened angular diameter 0.852 +/- 0.009 mas (CHARA) and the Hipparcos parallax, 2.079 +/- 0.025 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.94 +/- 0.006 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 118098: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.94 +/- 0.006 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 8,247 K from Boyajian et al. (2012), ApJ 746, 101, HD 118098: effective temperature in K, from the angular diameter and the bolometric flux, 8247 +/- 52. log g 4.09 from the mass and radius.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 659: HR 5107; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 174 (BS 5107) (8 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #c1d0ff. Routes tried in order: stis-ngsl: HD 118098 is not in the library; pulkovo: HR 5107 is not in the catalogue; kiehling: HR 5107 is not among its 60 stars; gaia-xp: found, not needed after the color and its cross-check; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,247 K and log g 4.09 (u1 0.316, u2 0.320): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 8 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
