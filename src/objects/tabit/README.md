# Tabit

## Sources

Its disc spans 1.526 milliarcseconds, which gives 1.323 solar radii and 6,516 K at its surface. It is also HD 30652, HR 1543, HIP 22449. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3288921720025503360, distance 8 pc from Boyajian et al. (2012), ApJ 746, 101, HD 30652: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 123.94 +/- 0.17 mas, inverted; Gaia DR3's parallax, 124.620 ± 0.225 mas (554.9 standard errors), is not used. Radius 1.323 +/- 0.004 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 30652: radius in solar radii, from the limb-darkened angular diameter 1.526 +/- 0.004 mas (CHARA) and the Hipparcos parallax, 1.323 +/- 0.004 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.283 +/- 0.006 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 30652: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.283 +/- 0.006 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,516 K from Boyajian et al. (2012), ApJ 746, 101, HD 30652: effective temperature in K, from the angular diameter and the bolometric flux, 6516 +/- 19. log g 4.3 from the mass and radius.

**Colour.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 306: HR 1543; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 49 (BS 1543), the widest of its 2 scans (12 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #edf1ff. Routes tried in order: stis-ngsl: HD 30652 is not in the library; pulkovo: HR 1543 is not in the catalogue; kiehling: HR 1543 is not among its 60 stars; gaia-xp: found, not needed after the colour and its cross-check; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,516 K and log g 4.3 (u1 0.348, u2 0.315): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 12 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
