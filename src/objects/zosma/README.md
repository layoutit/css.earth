# Zosma

## Sources

Its disc spans 1.328 milliarcseconds, which gives 2.557 solar radii and 8,085 K at its surface. It is also HD 97603, HR 4357, HIP 54872. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3990320597065899776, distance 18 pc from Boyajian et al. (2012), ApJ 746, 101, HD 97603: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 55.82 +/- 0.25 mas, inverted; Gaia DR3 gives it no parallax. Radius 2.557 +/- 0.02 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 97603: radius in solar radii, from the limb-darkened angular diameter 1.328 +/- 0.009 mas (CHARA) and the Hipparcos parallax, 2.557 +/- 0.02 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 2.061 +/- 0.006 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 97603: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 2.061 +/- 0.006 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 8,085 K from Boyajian et al. (2012), ApJ 746, 101, HD 97603: effective temperature in K, from the angular diameter and the bolometric flux, 8085 +/- 42. log g 3.94 from the mass and radius.

**Colour.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Zosma is HR 4357., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 590: HR 4357; VizieR III/202 (8 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #c8d8ff. Routes tried in order: stis-ngsl: HD 97603 is not in the library; kiehling: HR 4357 is not among its 60 stars; burnashev: found, not needed after the colour and its cross-check; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,085 K and log g 3.94 (u1 0.321, u2 0.319): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 8 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
