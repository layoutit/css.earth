# Xi Pegasi

## Sources

Its disc spans 1.091 milliarcseconds, which gives 1.912 solar radii and 6,167 K at its surface. It is also HD 215648, HR 8665, HIP 112447. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2719475542667772416, distance 16 pc from Boyajian et al. (2012), ApJ 746, 101, HD 215648: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 61.37 +/- 0.2 mas, inverted; Gaia DR3's parallax, 60.916 ± 0.174 mas (350.3 standard errors), is not used. Radius 1.912 +/- 0.016 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 215648: radius in solar radii, from the limb-darkened angular diameter 1.091 +/- 0.008 mas (CHARA) and the Hipparcos parallax, 1.912 +/- 0.016 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.192 +/- 0.011 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 215648: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.192 +/- 0.011 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,167 K from Boyajian et al. (2012), ApJ 746, 101, HD 215648: effective temperature in K, from the angular diameter and the bolometric flux, 6167 +/- 36. log g 3.95 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Xi Pegasi is HR 8665., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1079: HR 8665; VizieR III/202 (13 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fff8fc. Routes tried in order: stis-ngsl: HD 215648 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kiehling: HR 8665 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,167 K and log g 3.95 (u1 0.387, u2 0.299): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 13 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
