# Sigma Bootis

## Sources

Its disc spans 0.841 milliarcseconds, which gives 1.431 solar radii and 6,594 K at its surface. It is also HD 128167, HR 5447, HIP 71284. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1284257623084916480, distance 16 pc from Boyajian et al. (2012), ApJ 746, 101, HD 128167: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 63.16 +/- 0.26 mas, inverted; Gaia DR3's parallax, 63.468 ± 0.117 mas (540.9 standard errors), is not used. Radius 1.431 +/- 0.023 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 128167: radius in solar radii, from the limb-darkened angular diameter 0.841 +/- 0.013 mas (CHARA) and the Hipparcos parallax, 1.431 +/- 0.023 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.194 +/- 0.013 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 128167: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.194 +/- 0.013 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,594 K from Boyajian et al. (2012), ApJ 746, 101, HD 128167: effective temperature in K, from the angular diameter and the bolometric flux, 6594 +/- 55. log g 4.2 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1284257623084916480, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Sigma Bootis is HR 5447. (11 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #e2e6ff. Routes tried in order: stis-ngsl: HD 128167 is not in the library; kiehling: HR 5447 is not among its 60 stars; kharitonov: HR 5447 is not in the catalogue; burnashev: BS 5447 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,594 K and log g 4.2 (u1 0.342, u2 0.318): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 11 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
