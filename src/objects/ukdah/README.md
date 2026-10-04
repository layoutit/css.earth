# Ukdah

## Sources

Its brightness, measured band by band, gives 271 times the Sun's luminosity at 4,310 K, so 29.544 solar radii. It is also HD 83618, HR 3845, HIP 47431. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3827873938815011200, distance 81 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 47431: distance 80.71 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.011), at which the luminosity and radius hold; Gaia DR3's parallax, 12.906 ± 0.175 mas (73.7 standard errors), is not used. Radius 29.544 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 47431: radius 29.544 solar radii, implied by the fitted luminosity 270.611 solar luminosities (fractional uncertainty 0.059) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,310 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 47431: effective temperature 4310 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.066). log g 1.78 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Ukdah is HR 3845., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 547: HR 3845; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffd5a0. Routes tried in order: stis-ngsl: HD 83618 is not in the library; kiehling: HR 3845 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,310 K and log g 1.78 (u1 0.833, u2 -0.009): a model, because no fit of this star's limb is used. Gravity: log g 1.78 from 2024A&A...682A.145S; the 14 published values span log g 1.31 to 2.35, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Iota Hydrae" (revision 1370780452) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
