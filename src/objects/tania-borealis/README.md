# Tania Borealis

## Sources

Its brightness, measured band by band, gives 62 times the Sun's luminosity at 8,901 K, so 3.321 solar radii. It is also HD 89021, HR 4033, HIP 50372. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 805881416880407936, distance 42 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 50372: distance 42.158 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.033), at which the luminosity and radius hold; Gaia DR3's parallax, 14.459 ± 1.020 mas (14.2 standard errors), is not used. Radius 3.321 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 50372: radius 3.321 solar radii, implied by the fitted luminosity 62.191 solar luminosities (fractional uncertainty 0.604) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,901 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 50372: effective temperature 8901 +/- 2820 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.056). log g 3.9 from 1995A&A...294..536H ("Compositional differences among the A-type stars. II. Spectrum synthesis up to v sin i = 110 km/s.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 570: HR 4033; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 805881416880407936 (20 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #b8ceff. Routes tried in order: stis-ngsl: HD 89021 is not in the library; pulkovo: the spectrum was found but gives no color (A Pulkovo flux line is short:  320.0            .        0.0004430 0.0012930 0.0161000 0.0010410); kiehling: HR 4033 is not among its 60 stars; burnashev: BS 4033 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,901 K and log g 3.9 (u1 0.282, u2 0.317): a model, because no fit of this star's limb is used. Gravity: log g 3.9 from 1995A&A...294..536H, the median of its 2 spectra; the 2 published values span log g 3.9 to 3.9, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 20 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Lambda Ursae Majoris" (revision 1374609513) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
