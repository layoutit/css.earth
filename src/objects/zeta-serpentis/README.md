# Zeta Serpentis

## Sources

Its disc spans 0.775 milliarcseconds, which gives 1.961 solar radii and 6,529 K at its surface. It is also HD 164259, HR 6710, HIP 88175. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4177224620176470912, distance 24 pc from Boyajian et al. (2012), ApJ 746, 101, HD 164259: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 42.44 +/- 0.33 mas, inverted; Gaia DR3's parallax, 43.482 ± 0.132 mas (328.5 standard errors), is not used. Radius 1.961 +/- 0.071 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 164259: radius in solar radii, from the limb-darkened angular diameter 0.775 +/- 0.027 mas (CHARA) and the Hipparcos parallax, 1.961 +/- 0.071 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.429 +/- 0.013 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 164259: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.429 +/- 0.013 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,529 K from Boyajian et al. (2012), ApJ 746, 101, HD 164259: effective temperature in K, from the angular diameter and the bolometric flux, 6529 +/- 118. log g 4.01 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4177224620176470912, through the CIE 1931 2° observer: #e2e6ff. Routes tried in order: stis-ngsl: HD 164259 is not in the library; pulkovo: HR 6710 is not in the catalogue; kiehling: HR 6710 is not among its 60 stars; kharitonov: HR 6710 is not in the catalogue; burnashev: BS 6710 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,529 K and log g 4.01 (u1 0.348, u2 0.315): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
