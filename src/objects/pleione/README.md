# Pleione

## Sources

Its brightness, measured band by band, gives 95 times the Sun's luminosity at 7,548 K, so 5.695 solar radii. It is also HD 23862, HR 1180, HIP 17851. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 66529975427235712, distance 117 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17851: distance 117.096 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.036), at which the luminosity and radius hold; Gaia DR3's parallax, 7.241 ± 0.126 mas (57.7 standard errors), is not used. Radius 5.695 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17851: radius 5.695 solar radii, implied by the fitted luminosity 94.567 solar luminosities (fractional uncertainty 0.602) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 7,548 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17851: effective temperature 7548 +/- 2496 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.495). log g 3.82 from 2001A&A...378..861C ("High and intermediate-resolution spectroscopy of Be stars. An atlas of H{gamma}, HeI 4471 and MgII 4481 lines.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 230: HR 1180; VizieR III/202, through the CIE 1931 2° observer: #b7c4ff. Routes tried in order: stis-ngsl: HD 23862 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 1180 is not in the catalogue; kiehling: HR 1180 is not among its 60 stars; burnashev: BS 1180 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,548 K and log g 3.82 (u1 0.303, u2 0.330): a model, because no fit of this star's limb is used. Gravity: log g 3.82 from 2001A&A...378..861C; the 3 published values span log g 3.346 to 4.5, across which the limb law changes by at most 2.3% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Pleione (star)" (revision 1374878234) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
