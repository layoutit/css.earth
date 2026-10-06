# Grumium

## Sources

Its brightness, measured band by band, gives 49 times the Sun's luminosity at 4,521 K, so 11.456 solar radii. It is also HD 163588, HR 6688, HIP 87585. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1421593566062037120, distance 35 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 87585: distance 34.507 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.004), at which the luminosity and radius hold; Gaia DR3's parallax, 29.060 ± 0.115 mas (251.6 standard errors), is not used. Radius 11.456 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 87585: radius 11.456 solar radii, implied by the fitted luminosity 49.26 solar luminosities (fractional uncertainty 0.055) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,521 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 87585: effective temperature 4521 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.071). log g 2.56 from 2022A&A...666A.125F ("Abundances of disk and bulge giants from high-resolution optical spectra V. Molybdenum: The p-process element,.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 789: HR 6688; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 1421593566062037120 (27 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffddb1. Routes tried in order: stis-ngsl: HD 163588 is not in the library; pulkovo: HR 6688 is not in the catalogue; kiehling: HR 6688 is not among its 60 stars; burnashev: BS 6688 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,521 K and log g 2.56 (u1 0.774, u2 0.037): a model, because no fit of this star's limb is used. Gravity: log g 2.56 from 2022A&A...666A.125F; the 16 published values span log g 2.3 to 2.94, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 27 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Xi Draconis" (revision 1374548827) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
