# Koeia

## Sources

Its brightness, measured band by band, gives 0.086 times the Sun's luminosity at 3,947 K, so 0.628 solar radii. It is also HIP 12961. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5077642283022422656, distance 23 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 12961: distance 23.273 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.007), at which the luminosity and radius hold; Gaia DR3's parallax, 42.693 ± 0.014 mas (3018.1 standard errors), is not used. Radius 0.628 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 12961: radius 0.628 solar radii, implied by the fitted luminosity 0.086 solar luminosities (fractional uncertainty 0.064) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,947 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 12961: effective temperature 3947 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.054). log g 4.59 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** Gaia DR3 XP spectrum, source 5077642283022422656, through the CIE 1931 2° observer: #ffbf90. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,947 K and log g 4.59 (u1 0.545, u2 0.220): a model, because no fit of this star's limb is used. Gravity: log g 4.59 from 2024A&A...683A.125P; the 3 published values span log g 4.5903 to 4.65, across which the limb law changes by at most 0.7% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HIP 12961" (revision 1374438569) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
