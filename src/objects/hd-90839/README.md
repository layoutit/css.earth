# 36 Ursae Majoris

## Sources

Its disc spans 0.794 milliarcseconds, which gives 1.091 solar radii and 6,233 K at its surface. It is also HD 90839, HR 4112, HIP 51459. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 853819947756949120, distance 13 pc from Boyajian et al. (2012), ApJ 746, 101, HD 90839: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 78.26 +/- 0.29 mas, inverted; Gaia DR3's parallax, 77.249 ± 0.081 mas (959.5 standard errors), is not used. Radius 1.091 +/- 0.02 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 90839: radius in solar radii, from the limb-darkened angular diameter 0.794 +/- 0.014 mas (CHARA) and the Hipparcos parallax, 1.091 +/- 0.02 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.119 +/- 0.035 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 90839: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.119 +/- 0.035 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,233 K from Boyajian et al. (2012), ApJ 746, 101, HD 90839: effective temperature in K, from the angular diameter and the bolometric flux, 6233 +/- 68. log g 4.41 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 853819947756949120, through the CIE 1931 2° observer: #f7f4ff. Routes tried in order: stis-ngsl: HD 90839 is not in the library; pulkovo: HR 4112 is not in the catalogue; kiehling: HR 4112 is not among its 60 stars; kharitonov: HR 4112 is not in the catalogue; burnashev: BS 4112 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,233 K and log g 4.41 (u1 0.379, u2 0.304): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
