# Tarandus

## Sources

Its brightness, measured band by band, gives 174 times the Sun's luminosity at 4,563 K, so 21.12 solar radii. It is also HD 5848, HR 285, HIP 5372. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 574112955678493824, distance 86 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 5372: distance 85.911 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.013), at which the luminosity and radius hold; Gaia DR3's parallax, 10.803 ± 0.122 mas (88.8 standard errors), is not used. Radius 21.12 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 5372: radius 21.12 solar radii, implied by the fitted luminosity 173.733 solar luminosities (fractional uncertainty 0.056) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,563 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 5372: effective temperature 4563 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.073). log g 2.02 from 2021MNRAS.505.4496G ("An extension of the MILES library with derived T_eff_, log g, [Fe/H], and [{alpha}/Fe].").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Tarandus is HR 285., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 47: HR 285; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffdaa8. Routes tried in order: stis-ngsl: HD 5848 is not in the library; kiehling: HR 285 is not among its 60 stars; burnashev: BS 285 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,563 K and log g 2.02 (u1 0.751, u2 0.057): a model, because no fit of this star's limb is used. Gravity: log g 2.02 from 2021MNRAS.505.4496G; the 8 published values span log g 2.02 to 2.48, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "2 Ursae Minoris" (revision 1374618271) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
