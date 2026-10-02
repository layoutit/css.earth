# V987 Cassiopeiae

## Sources

Its disc spans 0.763 milliarcseconds, which gives 0.825 solar radii and 5,396 K at its surface. It is also HD 10780, HR 511, HIP 8362. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 512167948043650816, distance 10 pc from Boyajian et al. (2012), ApJ 746, 101, HD 10780: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 99.34 +/- 0.53 mas, inverted; Gaia DR3's parallax, 99.590 ± 0.044 mas (2271.9 standard errors), is not used. Radius 0.825 +/- 0.021 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 10780: radius in solar radii, from the limb-darkened angular diameter 0.763 +/- 0.019 mas (CHARA) and the Hipparcos parallax, 0.825 +/- 0.021 (https://doi.org/10.1088/0004-637X/746/1/101). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,396 K from Boyajian et al. (2012), ApJ 746, 101, HD 10780: effective temperature in K, from the angular diameter and the bolometric flux, 5396 +/- 72. log g 4.55 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Colour.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 10780: 168-1020 nm, cross-checked against Gaia DR3 XP spectrum, source 512167948043650816 (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffecde. Routes tried in order: pulkovo: HR 511 is not in the catalogue; kiehling: HR 511 is not among its 60 stars; kharitonov: found, not needed after the colour and its cross-check; burnashev: BS 511 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,396 K and log g 4.55 (u1 0.548, u2 0.201): a model, because no fit of this star's limb is used. Gravity: log g 4.55 from 2024A&A...682A.145S; the 47 published values span log g 4.13 to 4.65, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
