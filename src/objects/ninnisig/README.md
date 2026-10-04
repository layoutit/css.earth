# Ninnisig

## Sources

Its brightness, measured band by band, gives 1,579 times the Sun's luminosity at 4,507 K, so 65.259 solar radii. It is also HD 180809, HR 7314, HIP 94713. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2099385000742174592, distance 255 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 94713: distance 255.102 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.043), at which the luminosity and radius hold; Gaia DR3's parallax, 4.201 ± 0.105 mas (39.9 standard errors), is not used. Radius 65.259 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 94713: radius 65.259 solar radii, implied by the fitted luminosity 1578.8 solar luminosities (fractional uncertainty 0.07) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,507 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 94713: effective temperature 4507 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.07). log g 1.6 from 1995AJ....110.2425L ("Chemical abundances for F and G luminosity class II stars.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 848: HR 7314; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 2099385000742174592 (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffdaaf. Routes tried in order: stis-ngsl: HD 180809 is not in the library; pulkovo: HR 7314 is not in the catalogue; kiehling: HR 7314 is not among its 60 stars; burnashev: BS 7314 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,507 K and log g 1.6 (u1 0.764, u2 0.047): a model, because no fit of this star's limb is used. Gravity: log g 1.6 from 1995AJ....110.2425L, the median of its 3 spectra; the 8 published values span log g 1.6 to 1.93, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Theta Lyrae" (revision 1374745014) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
