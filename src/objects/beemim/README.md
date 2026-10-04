# Beemim

## Sources

Its brightness, measured band by band, gives 420 times the Sun's luminosity at 4,051 K, so 41.658 solar radii. It is also HD 28028, HR 1393, HIP 20535. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4871775051598300160, distance 91 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 20535: distance 90.826 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.034), at which the luminosity and radius hold; Gaia DR3's parallax, 11.127 ± 0.119 mas (93.6 standard errors), is not used. Radius 41.658 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 20535: radius 41.658 solar radii, implied by the fitted luminosity 419.888 solar luminosities (fractional uncertainty 0.07) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,051 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 20535: effective temperature 4051 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.088). log g 1.71 from 1990ApJS...74.1075M ("High-resolution spectroscopic survey of 671 GK giants. I. Stellar atmosphere parameters and abundances.").

**Color.** Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 40 (BS 1393), cross-checked against Gaia DR3 XP spectrum, source 4871775051598300160 (9 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcd90. Routes tried in order: stis-ngsl: HD 28028 is not in the library; pulkovo: HR 1393 is not in the catalogue; kiehling: HR 1393 is not among its 60 stars; kharitonov: HR 1393 is not in the catalogue; burnashev: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,051 K and log g 1.71 (u1 0.916, u2 -0.080): a model, because no fit of this star's limb is used. Gravity: log g 1.71 from 1990ApJS...74.1075M, the median of its 3 spectra; the 3 published values span log g 1.71 to 1.71, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 9 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Upsilon3 Eridani" (revision 1374550440) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
