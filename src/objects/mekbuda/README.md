# Mekbuda

## Sources

Its brightness, measured band by band, gives 4,497 times the Sun's luminosity at 5,335 K, so 78.606 solar radii. It is also HD 52973, HR 2650, HIP 34088. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3366754155291545344, distance 422 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 34088: distance 421.941 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.127), at which the luminosity and radius hold; Gaia DR3's parallax, 3.073 ± 0.218 mas (14.1 standard errors), is not used. Radius 78.606 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 34088: radius 78.606 solar radii, implied by the fitted luminosity 4497.23 solar luminosities (fractional uncertainty 0.135) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,335 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 34088: effective temperature 5335 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.116). log g 1.1 from 2023A&A...678A.195D ("Oxygen, sulfur, and iron radial abundance gradients of classical Cepheids across the Galactic thin disk.").

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 52973: 168-1020 nm, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 478 (BS 2650), the widest of its 4 scans (8 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffedd9. Routes tried in order: pulkovo: HR 2650 is not in the catalogue; kiehling: HR 2650 is not among its 60 stars; kharitonov: HR 2650 is not in the catalogue; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,335 K and log g 1.1 (u1 0.540, u2 0.192): a model, because no fit of this star's limb is used. Gravity: log g 1.1 from 2023A&A...678A.195D, the median of its 125 spectra; the 143 published values span log g 0.8 to 3.41, across which the limb law changes by at most 1.9% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 8 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Zeta Geminorum" (revision 1377232741) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
