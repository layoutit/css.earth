# Nihal

## Sources

Its brightness, measured band by band, gives 166 times the Sun's luminosity at 5,264 K, so 15.495 solar radii. It is also HD 36079, HR 1829, HIP 25606. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2968097043228517120, distance 49 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 25606: distance 49.164 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.009), at which the luminosity and radius hold; Gaia DR3's parallax, 20.870 ± 0.205 mas (101.9 standard errors), is not used. Radius 15.495 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 25606: radius 15.495 solar radii, implied by the fitted luminosity 165.621 solar luminosities (fractional uncertainty 0.048) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,264 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 25606: effective temperature 5264 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.043). log g 2.81 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Nihal is HR 1829., cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * bet Lep is HR 1829. (8 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffecd8. Routes tried in order: stis-ngsl: HD 36079 is not in the library; kharitonov: found, not needed after the color and its cross-check; burnashev: found, not needed after the color and its cross-check; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,264 K and log g 2.81 (u1 0.556, u2 0.198): a model, because no fit of this star's limb is used. Gravity: log g 2.81 from 2024A&A...683A.125P; the 14 published values span log g 2.1 to 2.96, across which the limb law changes by at most 0.4% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 8 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Leporis" (revision 1374617951) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
