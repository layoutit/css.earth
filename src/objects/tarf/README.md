# Tarf

## Sources

Its brightness, measured band by band, gives 598 times the Sun's luminosity at 4,103 K, so 48.474 solar radii. It is also HD 69267, HR 3249, HIP 40526. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3098404220680931968, distance 93 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 40526: distance 93.023 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.018), at which the luminosity and radius hold; Gaia DR3's parallax, 10.103 ± 0.314 mas (32.2 standard errors), is not used. Radius 48.474 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 40526: radius 48.474 solar radii, implied by the fitted luminosity 598.297 solar luminosities (fractional uncertainty 0.063) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,103 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 40526: effective temperature 4103 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.076). log g 1.28 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Tarf is HR 3249., cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * bet Cnc is HR 3249. (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcd8c. Routes tried in order: stis-ngsl: HD 69267 is not in the library; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 3249 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,103 K and log g 1.28 (u1 0.900, u2 -0.066): a model, because no fit of this star's limb is used. Gravity: log g 1.28 from 2024A&A...682A.145S; the 19 published values span log g 0.98 to 2.05, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Cancri" (revision 1374787876) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
