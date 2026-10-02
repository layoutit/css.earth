# Zavijava

## Sources

Its disc spans 1.431 milliarcseconds, which gives 1.681 solar radii and 6,132 K at its surface. It is also HD 102870, HR 4540, HIP 57757. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3796442680948579328, distance 11 pc from Boyajian et al. (2012), ApJ 746, 101, HD 102870: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 91.5 +/- 0.22 mas, inverted; Gaia DR3's parallax, 90.895 ± 0.193 mas (470.0 standard errors), is not used. Radius 1.681 +/- 0.008 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 102870: radius in solar radii, from the limb-darkened angular diameter 1.431 +/- 0.006 mas (CHARA) and the Hipparcos parallax, 1.681 +/- 0.008 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.324 +/- 0.005 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 102870: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.324 +/- 0.005 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,132 K from Boyajian et al. (2012), ApJ 746, 101, HD 102870: effective temperature in K, from the angular diameter and the bolometric flux, 6132 +/- 26. log g 4.11 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Zavijava is HR 4540., cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * bet Vir is HR 4540. (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fff8f8. Routes tried in order: stis-ngsl: HD 102870 is not in the library; kharitonov: found, not needed after the color and its cross-check; burnashev: found, not needed after the color and its cross-check; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,132 K and log g 4.11 (u1 0.393, u2 0.297): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
