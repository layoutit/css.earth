# HD 80607

## Sources

HD 80607 shares its motion through space with HD 80606, 1,355 AU away, so the two are a bound pair. Both are placed where Gaia measures them. It is also HIP 45983. The introduction is generated from El-Badry, Rix & Heintz (2021), MNRAS 506, 2269's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1019003329101872896, parallax 15.148 ± 0.016 mas (66.01 pc). Radius 1.016 +/- 0.059 solar radii from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the radius of TIC 457134361 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Mass 0.97 +/- 0.13 solar masses from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the mass of TIC 457134361 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Temperature 5,538.3 K from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the effective temperature of TIC 457134361 (VizieR IV/39/tic82). log g 4.41 from the mass and radius.

**Colour.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 80607: 168-1020 nm, cross-checked against Gaia DR3 XP spectrum, source 1019003329101872896 (2 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffeee0. Routes tried in order: pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,538.3 K and log g 4.41 (u1 0.512, u2 0.226): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 2 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** HD 80607's orbit around HD 80606 is not measured; both stars are placed at their Gaia DR3 positions, which is where they are.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
