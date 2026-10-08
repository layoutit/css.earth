# Megrez

## Sources

Its equatorial radius is 2.51 solar radii and its polar radius 1.89; the poles are near 9,550 K and the equator near 7,240 K. It is also HD 106591, HR 4660, HIP 59774. The introduction is generated from Jones et al. (2015), ApJ 813, 58's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1575287046603605888, distance 25 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 59774: distance 24.685 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.004), at which the luminosity and radius hold; Gaia DR3's parallax, 40.328 ± 0.195 mas (207.3 standard errors), is not used. Radius 2.285 solar radii from Jones et al. (2015), ApJ 813, 58, the table of model results under the gravity-darkening law of Espinosa Lara & Rieutord (2011), Megrez: equatorial radius 2.511 (+0.074, -0.068) and polar radius 1.893 (+0.046, -0.045) solar radii, from the Roche model fitted to CHARA visibilities and broadband photometry; the record holds the volume-equivalent sphere of the two, 2.285 solar radii, and the scene draws the flattening (https://doi.org/10.1088/0004-637X/813/1/58). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,694 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 59774: effective temperature 8694 +/- 1380 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.047). log g 3.94 from SIMBAD's compilation of spectroscopic measurements (mesFe_h): log g 3.94 from 2024A&A...681A.107R; the 3 published values span log g 3.6 to 3.9433, across which the limb law changes by at most 0.1% of the centre brightness.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 612: HR 4660; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 1575287046603605888 (12 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #bcd0ff. Routes tried in order: stis-ngsl: HD 106591 is not in the library; pulkovo: HR 4660 is not in the catalogue; kiehling: HR 4660 is not among its 60 stars; burnashev: BS 4660 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,694 K and log g 3.94 (u1 0.299, u2 0.312): a model, because no fit of this star's limb is used.

**Shape.** A Roche surface flattened by rotation, 2.511 solar radii at the equator and 1.893 at the poles, its pole 50 degrees from the line of sight at position angle 50.9 degrees, and gravity darkened with exponent 0.17 from a 9,550 K pole: Jones et al. (2015), ApJ 813, 58 (https://doi.org/10.1088/0004-637X/813/1/58). The record is [gravity-darkening.json](source/photometry/gravity-darkening.json), each value with its table cell.

## Evidence

Generated 2026-10-08 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 12 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The pole is measured; the rotation phase is a convention, and the star is not turned.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** How poorly the pole is placed on the sky: its position angle is 50.9 degrees with errors of +44.4 and -42.6 degrees and a 180 degree ambiguity, so the tilt drawn could be far off and which pole leans toward us is not measured.
- **Not shown.** The fit under von Zeipel's law (beta 0.25), which Jones et al. (2015) give beside this one without favoring either: a 10,030 K pole and a 6,909 K equator, a stronger contrast than the one drawn.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Megrez" (revision 1377341635) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
