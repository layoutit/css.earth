# Solaris

## Sources

Its brightness, measured band by band, gives 0.364 times the Sun's luminosity at 4,814 K, so 0.868 solar radii. It is also HIP 104780. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1759623813132980864, distance 50 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 104780: distance 49.743 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.012), at which the luminosity and radius hold; Gaia DR3's parallax, 20.284 ± 0.017 mas (1214.3 standard errors), is not used. Radius 0.868 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 104780: radius 0.868 solar radii, implied by the fitted luminosity 0.364 solar luminosities (fractional uncertainty 0.053) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,814 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 104780: effective temperature 4814 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.059). log g 4.9 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** Gaia DR3 XP spectrum, source 1759623813132980864, through the CIE 1931 2° observer: #ffdbc4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,814 K and log g 4.9 (u1 0.709, u2 0.075): a model, because no fit of this star's limb is used. Gravity: log g 4.9 from 2024A&A...683A.125P; the 6 published values span log g 4.03 to 4.9, across which the limb law changes by at most 0.5% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "BD+14 4559" (revision 1374437742) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
