# Muning

## Sources

Its disc spans 1.217 milliarcseconds, which gives 1.472 solar radii and 6,294 K at its surface. It is also HD 142860, HR 5933, HIP 78072. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1193030490492925824, distance 11 pc from Boyajian et al. (2012), ApJ 746, 101, HD 142860: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 88.85 +/- 0.18 mas, inverted; Gaia DR3's parallax, 89.565 ± 0.183 mas (488.2 standard errors), is not used. Radius 1.472 +/- 0.007 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 142860: radius in solar radii, from the limb-darkened angular diameter 1.217 +/- 0.005 mas (CHARA) and the Hipparcos parallax, 1.472 +/- 0.007 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.184 +/- 0.012 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 142860: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.184 +/- 0.012 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,294 K from Boyajian et al. (2012), ApJ 746, 101, HD 142860: effective temperature in K, from the angular diameter and the bolometric flux, 6294 +/- 29. log g 4.18 from the mass and radius.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 736: HR 5933; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 333 (BS 5933) (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #f1f5ff. Routes tried in order: stis-ngsl: the library marks HD 142860's spectrum DATAQUAL suspect; pulkovo: HR 5933 is not in the catalogue; kiehling: HR 5933 is not among its 60 stars; gaia-xp: found, not needed after the color and its cross-check; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,294 K and log g 4.18 (u1 0.372, u2 0.307): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
