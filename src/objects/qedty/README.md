# Qedty

## Sources

Its brightness, measured band by band, gives 50 times the Sun's luminosity at 4,675 K, so 10.83 solar radii. It is also HD 177873, HR 7242, HIP 94005. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6717240825593666304, distance 55 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 94005: distance 54.734 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.019), at which the luminosity and radius hold; Gaia DR3's parallax, 17.658 ± 0.246 mas (71.8 standard errors), is not used. Radius 10.83 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 94005: radius 10.83 solar radii, implied by the fitted luminosity 50.332 solar luminosities (fractional uncertainty 0.057) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,675 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 94005: effective temperature 4675 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.051). log g 2.64 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** A Planck spectrum at 4,675 K, because no archive holds a spectrum of this star (stis-ngsl: HD 177873 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 7242 is not in the catalogue; kiehling: HR 7242 is not among its 60 stars; kharitonov: HR 7242 is not in the catalogue; burnashev: BS 7242 is not in part2), through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: HD 177873 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 7242 is not in the catalogue; kiehling: HR 7242 is not among its 60 stars; kharitonov: HR 7242 is not in the catalogue; burnashev: BS 7242 is not in part2; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,675 K and log g 2.64 (u1 0.725, u2 0.075): a model, because no fit of this star's limb is used. Gravity: log g 2.64 from 2024A&A...683A.125P; the 3 published values span log g 2.59 to 2.643, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Delta Coronae Australis" (revision 1374547101) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
