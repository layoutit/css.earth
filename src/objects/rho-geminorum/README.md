# Rho Geminorum

## Sources

Its disc spans 0.853 milliarcseconds, which gives 1.655 solar radii and 6,899 K at its surface. It is also HD 58946, HR 2852, HIP 36366. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 892160231749198848, distance 18 pc from Boyajian et al. (2012), ApJ 746, 101, HD 58946: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 55.41 +/- 0.25 mas, inverted; Gaia DR3's parallax, 56.112 ± 0.392 mas (143.0 standard errors), is not used. Radius 1.655 +/- 0.028 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 58946: radius in solar radii, from the limb-darkened angular diameter 0.853 +/- 0.014 mas (CHARA) and the Hipparcos parallax, 1.655 +/- 0.028 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.355 +/- 0.013 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 58946: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.355 +/- 0.013 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,899 K from Boyajian et al. (2012), ApJ 746, 101, HD 58946: effective temperature in K, from the angular diameter and the bolometric flux, 6899 +/- 63. log g 4.13 from the mass and radius.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 478: HR 2852; VizieR III/202, through the CIE 1931 2° observer: #e5e6ff. Routes tried in order: stis-ngsl: HD 58946 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 2852 is not in the catalogue; kiehling: HR 2852 is not among its 60 stars; burnashev: BS 2852 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,899 K and log g 4.13 (u1 0.318, u2 0.328): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
