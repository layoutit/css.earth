# 18 Scorpii

## Sources

Its disc spans 0.78 milliarcseconds, which gives 1.166 solar radii and 5,433 K at its surface. It is also HD 146233, HR 6060, HIP 79672. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4345775217221821312, distance 14 pc from Boyajian et al. (2012), ApJ 746, 101, HD 146233: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 71.93 +/- 0.37 mas, inverted; Gaia DR3's parallax, 70.737 ± 0.063 mas (1120.6 standard errors), is not used. Radius 1.166 +/- 0.026 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 146233: radius in solar radii, from the limb-darkened angular diameter 0.78 +/- 0.017 mas (CHARA) and the Hipparcos parallax, 1.166 +/- 0.026 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 0.887 +/- 0.019 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 146233: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 0.887 +/- 0.019 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 5,433 K from Boyajian et al. (2012), ApJ 746, 101, HD 146233: effective temperature in K, from the angular diameter and the bolometric flux, 5433 +/- 69. log g 4.25 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4345775217221821312, through the CIE 1931 2° observer: #fff5f8. Routes tried in order: stis-ngsl: the library marks HD 146233's spectrum DATAQUAL suspect; pulkovo: HR 6060 is not in the catalogue; kiehling: HR 6060 is not among its 60 stars; kharitonov: HR 6060 is not in the catalogue; burnashev: BS 6060 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,433 K and log g 4.25 (u1 0.536, u2 0.210): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
