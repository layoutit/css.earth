# Edasich

## Sources

Its brightness, measured band by band, gives 57 times the Sun's luminosity at 4,570 K, so 12.083 solar radii. It is also HD 137759, HR 5744, HIP 75458. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1614731957531452544, distance 31 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 75458: distance 31.027 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.003), at which the luminosity and radius hold; Gaia DR3's parallax, 32.524 ± 0.131 mas (248.3 standard errors), is not used. Radius 12.083 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 75458: radius 12.083 solar radii, implied by the fitted luminosity 57.211 solar luminosities (fractional uncertainty 0.055) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,570 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 75458: effective temperature 4570 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.064). log g 2.42 from 2024A&A...691A..53S ("SWEET-Cat: A view on the planetary mass-radius relation.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Edasich is HR 5744., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 717: HR 5744; VizieR III/202 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffdbad. Routes tried in order: stis-ngsl: the library marks HD 137759's spectrum DATAQUAL suspect; kiehling: HR 5744 is not among its 60 stars; burnashev: BS 5744 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,570 K and log g 2.42 (u1 0.756, u2 0.052): a model, because no fit of this star's limb is used. Gravity: log g 2.42 from 2024A&A...691A..53S; the 30 published values span log g 2.38 to 3.67, across which the limb law changes by at most 0.6% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Iota Draconis" (revision 1375290884) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
