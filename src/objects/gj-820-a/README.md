# 61 Cygni A

## Sources

Interferometry gives it 0.6611 solar radii; with its total light, that makes its surface 4,361 K. It is also HD 201091, HR 8085, HIP 104214. The introduction is generated from Boyajian et al. (2012), ApJ 757, 112's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1872046609345556480, parallax 285.995 ± 0.060 mas (3.50 pc). Radius 0.6611 +/- 0.0048 solar radii from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 820A: radius in solar radii, 0.6611 +/- 0.0048, from the weighted mean of the interferometric measurements the table lists (https://doi.org/10.1088/0004-637X/757/2/112). Mass 0.68 solar masses from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 820A: mass 0.68 solar masses from the K-band mass-luminosity relation of Henry & McCarthy (1993), not a dynamical mass (https://doi.org/10.1088/0004-637X/757/2/112). Temperature 4,361 K from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 820A: effective temperature in K, 4361 +/- 17, from the weighted mean of the interferometric measurements the table lists. log g 4.63 from the mass and radius.

**Colour.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 201091: 168-1020 nm, cross-checked against Gaia DR3 XP spectrum, source 1872046609345556480 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcfaa. Routes tried in order: pulkovo: HR 8085 is not in the catalogue; kiehling: HR 8085 is not among its 60 stars; kharitonov: HR 8085 is not in the catalogue; burnashev: BS 8085 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,361 K and log g 4.63 (u1 0.753, u2 0.038): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
