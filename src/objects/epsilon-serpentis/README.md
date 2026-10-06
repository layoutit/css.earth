# Epsilon Serpentis

## Sources

Its disc spans 0.768 milliarcseconds, which gives 1.783 solar radii and 8,084 K at its surface. It is also HD 141795, HR 5892, HIP 77622. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4426032591025363200, distance 22 pc from Boyajian et al. (2012), ApJ 746, 101, HD 141795: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 46.28 +/- 0.19 mas, inverted; Gaia DR3's parallax, 45.329 ± 0.250 mas (181.4 standard errors), is not used. Radius 1.783 +/- 0.04 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 141795: radius in solar radii, from the limb-darkened angular diameter 0.768 +/- 0.017 mas (CHARA) and the Hipparcos parallax, 1.783 +/- 0.04 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.82 +/- 0.026 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 141795: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.82 +/- 0.026 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 8,084 K from Boyajian et al. (2012), ApJ 746, 101, HD 141795: effective temperature in K, from the angular diameter and the bolometric flux, 8084 +/- 102. log g 4.2 from the mass and radius.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 141795: 168-1020 nm, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Epsilon Serpentis is HR 5892. (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #c6d5ff. Routes tried in order: kiehling: HR 5892 is not among its 60 stars; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 5892 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,084 K and log g 4.2 (u1 0.295, u2 0.336): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
