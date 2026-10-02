# Kappa Ceti

## Sources

Its disc spans 0.936 milliarcseconds, which gives 0.919 solar radii and 5,776 K at its surface. It is also HD 20630, HR 996, HIP 15457. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3269362645115584640, distance 9 pc from Boyajian et al. (2012), ApJ 746, 101, HD 20630: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 109.39 +/- 0.27 mas, inverted; Gaia DR3's parallax, 107.802 ± 0.184 mas (586.6 standard errors), is not used. Radius 0.919 +/- 0.025 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 20630: radius in solar radii, from the limb-darkened angular diameter 0.936 +/- 0.025 mas (CHARA) and the Hipparcos parallax, 0.919 +/- 0.025 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.037 +/- 0.042 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 20630: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.037 +/- 0.042 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 5,776 K from Boyajian et al. (2012), ApJ 746, 101, HD 20630: effective temperature in K, from the angular diameter and the bolometric flux, 5776 +/- 81. log g 4.53 from the mass and radius.

**Colour.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 20630: 168-1020 nm, through the CIE 1931 2° observer: #fff3ee. Routes tried in order: gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 996 is not in the catalogue; kiehling: HR 996 is not among its 60 stars; kharitonov: HR 996 is not in the catalogue; burnashev: BS 996 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,776 K and log g 4.53 (u1 0.460, u2 0.260): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
