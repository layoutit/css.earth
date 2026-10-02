# Keid

## Sources

Interferometry gives it 0.8051 solar radii; with its total light, that makes its surface 5,147 K. It is also HD 26965, HR 1325, HIP 19849. The introduction is generated from Boyajian et al. (2012), ApJ 757, 112's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3195919528989223040, parallax 199.608 ± 0.121 mas (5.01 pc); its RUWE is 1.9, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.8051 +/- 0.0035 solar radii from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 166A: radius in solar radii, 0.8051 +/- 0.0035, from the weighted mean of the interferometric measurements the table lists (https://doi.org/10.1088/0004-637X/757/2/112). Mass 0.816 solar masses from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 166A: mass 0.816 solar masses from the K-band mass-luminosity relation of Henry & McCarthy (1993), not a dynamical mass (https://doi.org/10.1088/0004-637X/757/2/112). Temperature 5,147 K from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 166A: effective temperature in K, 5147 +/- 14, from the weighted mean of the interferometric measurements the table lists. log g 4.54 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3195919528989223040, cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * omi02 Eri is HR 1325. (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe9de. Routes tried in order: stis-ngsl: HD 26965 is not in the library; pulkovo: HR 1325 is not in the catalogue; kharitonov: HR 1325 is not in the catalogue; burnashev: BS 1325 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,147 K and log g 4.54 (u1 0.615, u2 0.152): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
