# Nusakan

## Sources

Its brightness, measured band by band, gives 29 times the Sun's luminosity at 8,047 K, so 2.779 solar radii. It is also HD 137909, HR 5747, HIP 75695. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1273423791421021568, distance 34 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 75695: distance 34.282 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.026), at which the luminosity and radius hold; Gaia DR3's parallax, 27.926 ± 0.970 mas (28.8 standard errors), is not used. Radius 2.779 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 75695: radius 2.779 solar radii, implied by the fitted luminosity 29.098 solar luminosities (fractional uncertainty 0.867) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,047 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 75695: effective temperature 8047 +/- 3771 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.066). log g 3.75 from 2024A&A...681A.107R ("MELCHIORS The Mercator Library of High Resolution Stellar Spectroscopy.").

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 137909: 168-1020 nm, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Nusakan is HR 5747. (11 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #d0ddff. Routes tried in order: kiehling: HR 5747 is not among its 60 stars; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 5747 is not in part2; gaia-xp: found, not needed after the color and its cross-check; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,047 K and log g 3.75 (u1 0.335, u2 0.311): a model, because no fit of this star's limb is used. Gravity: log g 3.75 from 2024A&A...681A.107R; the 12 published values span log g 3.7526 to 4.5, across which the limb law changes by at most 3.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 11 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Coronae Borealis" (revision 1370773559) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
