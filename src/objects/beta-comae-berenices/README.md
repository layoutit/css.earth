# Beta Comae Berenices

## Sources

Its disc spans 1.127 milliarcseconds, which gives 1.106 solar radii and 5,936 K at its surface. It is also HD 114710, HR 4983, HIP 64394. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1460229442589223424, distance 9 pc from Boyajian et al. (2012), ApJ 746, 101, HD 114710: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 109.53 +/- 0.17 mas, inverted; Gaia DR3's parallax, 108.725 ± 0.164 mas (661.1 standard errors), is not used. Radius 1.106 +/- 0.011 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 114710: radius in solar radii, from the limb-darkened angular diameter 1.127 +/- 0.011 mas (CHARA) and the Hipparcos parallax, 1.106 +/- 0.011 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.045 +/- 0.013 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 114710: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.045 +/- 0.013 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 5,936 K from Boyajian et al. (2012), ApJ 746, 101, HD 114710: effective temperature in K, from the angular diameter and the bolometric flux, 5936 +/- 33. log g 4.37 from the mass and radius.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 114710: 168-1020 nm, cross-checked against Gaia DR3 XP spectrum, source 1460229442589223424 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fff8fb. Routes tried in order: pulkovo: HR 4983 is not in the catalogue; kiehling: HR 4983 is not among its 60 stars; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 4983 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,936 K and log g 4.37 (u1 0.427, u2 0.279): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
