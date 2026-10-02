# Lalande 21185

## Sources

Interferometry gives it 0.3924 solar radii; with its total light, that makes its surface 3,464 K. It is also HD 95735, HIP 54035. The introduction is generated from Boyajian et al. (2012), ApJ 757, 112's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 762815470562110464, parallax 392.753 ± 0.032 mas (2.55 pc). Radius 0.3924 +/- 0.0033 solar radii from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 411: radius in solar radii, 0.3924 +/- 0.0033, from the weighted mean of the interferometric measurements the table lists (https://doi.org/10.1088/0004-637X/757/2/112). Mass 0.403 solar masses from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 411: mass 0.403 solar masses from the K-band mass-luminosity relation of Henry & McCarthy (1993), not a dynamical mass (https://doi.org/10.1088/0004-637X/757/2/112). Temperature 3,464 K from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 411: effective temperature in K, 3464 +/- 15, from the weighted mean of the interferometric measurements the table lists. log g 4.86 from the mass and radius.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 95735: 168-1020 nm, cross-checked against Gaia DR3 XP spectrum, source 762815470562110464 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffc887. Routes tried in order: pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,464 K and log g 4.86 (u1 0.168, u2 0.434): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
