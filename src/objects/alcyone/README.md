# Alcyone

## Sources

Its brightness, measured band by band, gives 844 times the Sun's luminosity at 8,392 K, so 13.762 solar radii. It is also HD 23630, HR 1165, HIP 17702. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 66714384142368256, distance 124 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17702: distance 123.609 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.052), at which the luminosity and radius hold; Gaia DR3 gives it no parallax. Radius 13.762 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17702: radius 13.762 solar radii, implied by the fitted luminosity 843.922 solar luminosities (fractional uncertainty 0.91) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,392 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17702: effective temperature 8392 +/- 4070 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.113). log g 4 from 2001A&A...378..861C ("High and intermediate-resolution spectroscopy of Be stars. An atlas of H{gamma}, HeI 4471 and MgII 4481 lines.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 222: HR 1165; VizieR III/202, through the CIE 1931 2° observer: #aec4ff. Routes tried in order: stis-ngsl: HD 23630 is not in the library; pulkovo: HR 1165 is not in the catalogue; kiehling: HR 1165 is not among its 60 stars; burnashev: BS 1165 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,392 K and log g 4 (u1 0.321, u2 0.310): a model, because no fit of this star's limb is used. Gravity: log g 4 from 2001A&A...378..861C; the 1 published value span log g 4 to 4, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alcyone (star)" (revision 1374779784) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
