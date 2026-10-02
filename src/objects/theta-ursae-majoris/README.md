# Theta Ursae Majoris

## Sources

Its disc spans 1.632 milliarcseconds, which gives 2.365 solar radii and 6,300 K at its surface. It is also HD 82328, HR 3775, HIP 46853. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1018776176872261248, distance 13 pc from Boyajian et al. (2012), ApJ 746, 101, HD 82328: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 74.18 +/- 0.13 mas, inverted; Gaia DR3's parallax, 73.828 ± 0.205 mas (360.8 standard errors), is not used. Radius 2.365 +/- 0.008 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 82328: radius in solar radii, from the limb-darkened angular diameter 1.632 +/- 0.005 mas (CHARA) and the Hipparcos parallax, 2.365 +/- 0.008 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.506 +/- 0.095 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 82328: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.506 +/- 0.095 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,300 K from Boyajian et al. (2012), ApJ 746, 101, HD 82328: effective temperature in K, from the angular diameter and the bolometric flux, 6300 +/- 33. log g 3.87 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Theta Ursae Majoris is HR 3775., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 543: HR 3775; VizieR III/202 (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fbf8ff. Routes tried in order: stis-ngsl: HD 82328 is not in the library; kiehling: HR 3775 is not among its 60 stars; burnashev: BS 3775 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,300 K and log g 3.87 (u1 0.370, u2 0.306): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
