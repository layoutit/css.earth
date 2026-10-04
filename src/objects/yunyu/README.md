# Yunyu

## Sources

Its brightness, measured band by band, gives 63 times the Sun's luminosity at 4,896 K, so 11.028 solar radii. It is also HD 219615, HR 8852, HIP 114971. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2658974606111711488, distance 42 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 114971: distance 42.301 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.008), at which the luminosity and radius hold; Gaia DR3's parallax, 24.196 ± 0.297 mas (81.5 standard errors), is not used. Radius 11.028 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 114971: radius 11.028 solar radii, implied by the fitted luminosity 62.783 solar luminosities (fractional uncertainty 0.052) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,896 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 114971: effective temperature 4896 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.04). log g 2.44 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Yunyu is HR 8852., through the CIE 1931 2° observer: #ffe8cb. Routes tried in order: stis-ngsl: HD 219615 is not in the library; kiehling: HR 8852 is not among its 60 stars; kharitonov: HR 8852 is not in the catalogue; burnashev: BS 8852 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,896 K and log g 2.44 (u1 0.655, u2 0.129): a model, because no fit of this star's limb is used. Gravity: log g 2.44 from 2024A&A...682A.145S; the 33 published values span log g 2.25 to 3.04, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Gamma Piscium" (revision 1375892483) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
