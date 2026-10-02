# Iota Persei

## Sources

Its disc spans 1.246 milliarcseconds, which gives 1.412 solar radii and 5,915 K at its surface. It is also HD 19373, HR 937, HIP 14632. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 436648129327098496, distance 11 pc from Boyajian et al. (2012), ApJ 746, 101, HD 19373: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 94.87 +/- 0.23 mas, inverted; Gaia DR3's parallax, 94.541 ± 0.145 mas (652.9 standard errors), is not used. Radius 1.412 +/- 0.009 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 19373: radius in solar radii, from the limb-darkened angular diameter 1.246 +/- 0.008 mas (CHARA) and the Hipparcos parallax, 1.412 +/- 0.009 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.169 +/- 0.013 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 19373: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.169 +/- 0.013 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 5,915 K from Boyajian et al. (2012), ApJ 746, 101, HD 19373: effective temperature in K, from the angular diameter and the bolometric flux, 5915 +/- 29. log g 4.21 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Iota Persei is HR 937., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 162: HR 937; VizieR III/202 (14 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fff5f3. Routes tried in order: stis-ngsl: HD 19373 is not in the library; kiehling: HR 937 is not among its 60 stars; burnashev: BS 937 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,915 K and log g 4.21 (u1 0.429, u2 0.278): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 14 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
