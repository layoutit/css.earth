# Fafnir

## Sources

Its brightness, measured band by band, gives 138 times the Sun's luminosity at 4,473 K, so 19.571 solar radii. It is also HD 170693, HR 6945, HIP 90344. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2256800156349110528, distance 97 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 90344: distance 96.525 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.019), at which the luminosity and radius hold; Gaia DR3's parallax, 11.056 ± 0.084 mas (131.4 standard errors), is not used. Radius 19.571 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 90344: radius 19.571 solar radii, implied by the fitted luminosity 137.762 solar luminosities (fractional uncertainty 0.059) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,473 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 90344: effective temperature 4473 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.057). log g 1.86 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** Gaia DR3 XP spectrum, source 2256800156349110528, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Fafnir is HR 6945. (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffdab3. Routes tried in order: stis-ngsl: HD 170693 is not in the library; kiehling: HR 6945 is not among its 60 stars; kharitonov: HR 6945 is not in the catalogue; burnashev: BS 6945 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,473 K and log g 1.86 (u1 0.778, u2 0.036): a model, because no fit of this star's limb is used. Gravity: log g 1.86 from 2024A&A...682A.145S; the 30 published values span log g 0.74 to 2.57, across which the limb law changes by at most 0.9% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "42 Draconis" (revision 1377637441) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
