# Lambda Geminorum

## Sources

Its disc spans 0.835 milliarcseconds, which gives 2.777 solar radii and 8,007 K at its surface. It is also HD 56537, HR 2763, HIP 35350. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3168265196643846400, distance 31 pc from Boyajian et al. (2012), ApJ 746, 101, HD 56537: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 32.36 +/- 0.22 mas, inverted; Gaia DR3's parallax, 32.607 ± 0.206 mas (158.1 standard errors), is not used. Radius 2.777 +/- 0.047 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 56537: radius in solar radii, from the limb-darkened angular diameter 0.835 +/- 0.013 mas (CHARA) and the Hipparcos parallax, 2.777 +/- 0.047 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 2.111 +/- 0.01 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 56537: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 2.111 +/- 0.01 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 8,007 K from Boyajian et al. (2012), ApJ 746, 101, HD 56537: effective temperature in K, from the angular diameter and the bolometric flux, 8007 +/- 77. log g 3.88 from the mass and radius.

**Colour.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 473: HR 2763; VizieR III/202, through the CIE 1931 2° observer: #c0cfff. Routes tried in order: stis-ngsl: HD 56537 is not in the library; pulkovo: HR 2763 is not in the catalogue; kiehling: HR 2763 is not among its 60 stars; burnashev: BS 2763 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,007 K and log g 3.88 (u1 0.324, u2 0.319): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
