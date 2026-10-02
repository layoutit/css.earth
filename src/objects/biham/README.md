# Biham

## Sources

Its disc spans 0.862 milliarcseconds, which gives 2.623 solar radii and 7,951 K at its surface. It is also HD 210418, HR 8450, HIP 109427. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2720428303852574336, distance 28 pc from Boyajian et al. (2012), ApJ 746, 101, HD 210418: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 35.34 +/- 0.85 mas, inverted; Gaia DR3 gives it no parallax. Radius 2.623 +/- 0.083 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 210418: radius in solar radii, from the limb-darkened angular diameter 0.862 +/- 0.018 mas (CHARA) and the Hipparcos parallax, 2.623 +/- 0.083 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.858 +/- 0.024 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 210418: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.858 +/- 0.024 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 7,951 K from Boyajian et al. (2012), ApJ 746, 101, HD 210418: effective temperature in K, from the angular diameter and the bolometric flux, 7951 +/- 97. log g 3.87 from the mass and radius.

**Colour.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1042: HR 8450; VizieR III/202, through the CIE 1931 2° observer: #bfd1ff. Routes tried in order: stis-ngsl: HD 210418 is not in the library; pulkovo: HR 8450 is not in the catalogue; kiehling: HR 8450 is not among its 60 stars; burnashev: BS 8450 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,951 K and log g 3.87 (u1 0.322, u2 0.320): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
