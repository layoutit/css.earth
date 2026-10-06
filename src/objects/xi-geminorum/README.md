# Alzirr

## Sources

Its disc spans 1.401 milliarcseconds, which gives 2.71 solar radii and 6,480 K at its surface. It is also HD 48737, HR 2484, HIP 32362. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3352485999058854912, distance 18 pc from Boyajian et al. (2012), ApJ 746, 101, HD 48737: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 55.55 +/- 0.19 mas, inverted; Gaia DR3's parallax, 54.189 ± 0.237 mas (228.7 standard errors), is not used. Radius 2.71 +/- 0.021 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 48737: radius in solar radii, from the limb-darkened angular diameter 1.401 +/- 0.009 mas (CHARA) and the Hipparcos parallax, 2.71 +/- 0.021 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.706 +/- 0.012 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 48737: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.706 +/- 0.012 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,480 K from Boyajian et al. (2012), ApJ 746, 101, HD 48737: effective temperature in K, from the angular diameter and the bolometric flux, 6480 +/- 39. log g 3.8 from the mass and radius.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 448: HR 2484; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 88 (BS 2484) (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #f5efff. Routes tried in order: stis-ngsl: HD 48737 is not in the library; pulkovo: HR 2484 is not in the catalogue; kiehling: HR 2484 is not among its 60 stars; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,480 K and log g 3.8 (u1 0.352, u2 0.313): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
