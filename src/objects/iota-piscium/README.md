# Puwuh Atarung

## Sources

Its disc spans 1.082 milliarcseconds, which gives 1.595 solar radii and 6,288 K at its surface. It is also HD 222368, HR 8969, HIP 116771. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2756363608023588864, distance 14 pc from Boyajian et al. (2012), ApJ 746, 101, HD 222368: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 72.91 +/- 0.15 mas, inverted; Gaia DR3's parallax, 73.237 ± 0.170 mas (431.4 standard errors), is not used. Radius 1.595 +/- 0.014 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 222368: radius in solar radii, from the limb-darkened angular diameter 1.082 +/- 0.009 mas (CHARA) and the Hipparcos parallax, 1.595 +/- 0.014 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.268 +/- 0.009 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 222368: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.268 +/- 0.009 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,288 K from Boyajian et al. (2012), ApJ 746, 101, HD 222368: effective temperature in K, from the angular diameter and the bolometric flux, 6288 +/- 37. log g 4.14 from the mass and radius.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1127: HR 8969; VizieR III/202, through the CIE 1931 2° observer: #f9f5ff. Routes tried in order: stis-ngsl: HD 222368 is not in the library; pulkovo: HR 8969 is not in the catalogue; kiehling: HR 8969 is not among its 60 stars; burnashev: BS 8969 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,288 K and log g 4.14 (u1 0.372, u2 0.306): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
