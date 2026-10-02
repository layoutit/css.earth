# 61 Ursae Majoris

## Sources

Its disc spans 0.91 milliarcseconds, which gives 0.94 solar radii and 5,270 K at its surface. It is also HD 101501, HR 4496, HIP 56997. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4025850731201819392, distance 10 pc from Boyajian et al. (2012), ApJ 746, 101, HD 101501: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 104.03 +/- 0.26 mas, inverted; Gaia DR3's parallax, 104.425 ± 0.100 mas (1039.1 standard errors), is not used. Radius 0.94 +/- 0.01 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 101501: radius in solar radii, from the limb-darkened angular diameter 0.91 +/- 0.009 mas (CHARA) and the Hipparcos parallax, 0.94 +/- 0.01 (https://doi.org/10.1088/0004-637X/746/1/101). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,270 K from Boyajian et al. (2012), ApJ 746, 101, HD 101501: effective temperature in K, from the angular diameter and the bolometric flux, 5270 +/- 32. log g 4.42 from 2025A&A...698A..93J ("A search for Maunder-minimum candidate stars.").

**Colour.** Gaia DR3 XP spectrum, source 4025850731201819392, through the CIE 1931 2° observer: #fff0e9. Routes tried in order: stis-ngsl: HD 101501 is not in the library; pulkovo: HR 4496 is not in the catalogue; kiehling: HR 4496 is not among its 60 stars; kharitonov: HR 4496 is not in the catalogue; burnashev: BS 4496 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,270 K and log g 4.42 (u1 0.580, u2 0.179): a model, because no fit of this star's limb is used. Gravity: log g 4.42 from 2025A&A...698A..93J; the 46 published values span log g 4.34 to 4.69, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
