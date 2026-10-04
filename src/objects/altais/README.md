# Altais

## Sources

Its brightness, measured band by band, gives 55 times the Sun's luminosity at 4,889 K, so 10.395 solar radii. It is also HD 180711, HR 7310, HIP 94376. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2255173119658513408, distance 30 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 94376: distance 29.869 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.003), at which the luminosity and radius hold; Gaia DR3's parallax, 33.350 ± 0.157 mas (212.8 standard errors), is not used. Radius 10.395 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 94376: radius 10.395 solar radii, implied by the fitted luminosity 55.469 solar luminosities (fractional uncertainty 0.051) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,889 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 94376: effective temperature 4889 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.041). log g 2.71 from 2022A&A...666A.125F ("Abundances of disk and bulge giants from high-resolution optical spectra V. Molybdenum: The p-process element,.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Altais is HR 7310., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 845: HR 7310; VizieR III/202 (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe5c2. Routes tried in order: stis-ngsl: HD 180711 is not in the library; kiehling: HR 7310 is not among its 60 stars; burnashev: BS 7310 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,889 K and log g 2.71 (u1 0.660, u2 0.124): a model, because no fit of this star's limb is used. Gravity: log g 2.71 from 2022A&A...666A.125F; the 26 published values span log g 2.1 to 3, across which the limb law changes by at most 0.3% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Delta Draconis" (revision 1374593121) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
