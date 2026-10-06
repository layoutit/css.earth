# Alsafi

## Sources

Its disc spans 1.254 milliarcseconds, which gives 0.776 solar radii and 5,255 K at its surface. It is also HD 185144, HR 7462, HIP 96100. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2261614264931057664, distance 6 pc from Boyajian et al. (2012), ApJ 746, 101, HD 185144: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 173.77 +/- 0.18 mas, inverted; Gaia DR3's parallax, 173.494 ± 0.075 mas (2319.2 standard errors), is not used. Radius 0.776 +/- 0.008 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 185144: radius in solar radii, from the limb-darkened angular diameter 1.254 +/- 0.012 mas (CHARA) and the Hipparcos parallax, 0.776 +/- 0.008 (https://doi.org/10.1088/0004-637X/746/1/101). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,255 K from Boyajian et al. (2012), ApJ 746, 101, HD 185144: effective temperature in K, from the angular diameter and the bolometric flux, 5255 +/- 31. log g 4.56 from 2025A&A...698A..93J ("A search for Maunder-minimum candidate stars.").

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 185144: 168-1020 nm, cross-checked against Gaia DR3 XP spectrum, source 2261614264931057664 (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffebdb. Routes tried in order: pulkovo: found, not needed after the color and its cross-check; kiehling: HR 7462 is not among its 60 stars; kharitonov: HR 7462 is not in the catalogue; burnashev: BS 7462 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,255 K and log g 4.56 (u1 0.585, u2 0.175): a model, because no fit of this star's limb is used. Gravity: log g 4.56 from 2025A&A...698A..93J; the 58 published values span log g 4.2 to 4.67, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
