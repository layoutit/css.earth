# Theta Cygni

## Sources

Its disc spans 0.861 milliarcseconds, which gives 1.697 solar radii and 6,381 K at its surface. It is also HD 185395, HR 7469, HIP 96441. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2135110401277424384, distance 18 pc from Boyajian et al. (2012), ApJ 746, 101, HD 185395: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 54.55 +/- 0.15 mas, inverted; Gaia DR3's parallax, 54.270 ± 0.086 mas (631.2 standard errors), is not used. Radius 1.697 +/- 0.03 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 185395: radius in solar radii, from the limb-darkened angular diameter 0.861 +/- 0.015 mas (CHARA) and the Hipparcos parallax, 1.697 +/- 0.03 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.342 +/- 0.011 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 185395: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.342 +/- 0.011 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,381 K from Boyajian et al. (2012), ApJ 746, 101, HD 185395: effective temperature in K, from the angular diameter and the bolometric flux, 6381 +/- 65. log g 4.11 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2135110401277424384, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Theta Cygni is HR 7469. (10 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #e5e8ff. Routes tried in order: stis-ngsl: HD 185395 is not in the library; kiehling: HR 7469 is not among its 60 stars; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 7469 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,381 K and log g 4.11 (u1 0.363, u2 0.310): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 10 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
