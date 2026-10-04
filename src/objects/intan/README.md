# Intan

## Sources

Its brightness, measured band by band, gives 0.267 times the Sun's luminosity at 4,729 K, so 0.771 solar radii. It is also HD 20868, HIP 15578. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5053536074700031616, distance 48 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 15578: distance 48.189 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.012), at which the luminosity and radius hold; Gaia DR3's parallax, 20.956 ± 0.013 mas (1643.3 standard errors), is not used. Radius 0.771 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 15578: radius 0.771 solar radii, implied by the fitted luminosity 0.267 solar luminosities (fractional uncertainty 0.054) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,729 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 15578: effective temperature 4729 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.04). log g 4.9 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** Gaia DR3 XP spectrum, source 5053536074700031616, through the CIE 1931 2° observer: #ffd6bc. Routes tried in order: stis-ngsl: HD 20868 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,729 K and log g 4.9 (u1 0.728, u2 0.059): a model, because no fit of this star's limb is used. Gravity: log g 4.9 from 2024A&A...683A.125P; the 8 published values span log g 4.12 to 4.9, across which the limb law changes by at most 0.6% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 20868" (revision 1367951650) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
