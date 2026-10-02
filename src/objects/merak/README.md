# Merak

## Sources

Its disc spans 1.149 milliarcseconds, which gives 3.021 solar radii and 9,377 K at its surface. It is also HD 95418, HR 4295, HIP 53910. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 856096765753549056, distance 24 pc from Boyajian et al. (2012), ApJ 746, 101, HD 95418: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 40.89 +/- 0.16 mas, inverted; Gaia DR3's parallax, 38.603 ± 1.128 mas (34.2 standard errors), is not used. Radius 3.021 +/- 0.038 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 95418: radius in solar radii, from the limb-darkened angular diameter 1.149 +/- 0.014 mas (CHARA) and the Hipparcos parallax, 3.021 +/- 0.038 (https://doi.org/10.1088/0004-637X/746/1/101). No mass is measured, so GM is 0, the records' unpublished value. Temperature 9,377 K from Boyajian et al. (2012), ApJ 746, 101, HD 95418: effective temperature in K, from the angular diameter and the bolometric flux, 9377 +/- 75. log g 3.68 from 2023ApJS..266...41P ("HST Low-resolution Stellar Library.").

**Colour.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 95418: 168-1020 nm, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Merak is HR 4295. (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #b9caff. Routes tried in order: kiehling: HR 4295 is not among its 60 stars; kharitonov: found, not needed after the colour and its cross-check; burnashev: BS 4295 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 9,377 K and log g 3.68 (u1 0.253, u2 0.324): a model, because no fit of this star's limb is used. Gravity: log g 3.68 from 2023ApJS..266...41P; the 10 published values span log g 3.1 to 4.3, across which the limb law changes by at most 0.3% of the centre brightness.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
