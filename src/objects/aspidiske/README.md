# Aspidiske

## Sources

Its brightness, measured band by band, gives 5,027 times the Sun's luminosity at 7,098 K, so 46.95 solar radii. It is also HD 80404, HR 3699, HIP 45556. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5300300156538723328, distance 235 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 45556: distance 234.742 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.023), at which the luminosity and radius hold; Gaia DR3 gives it no parallax. Radius 46.95 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 45556: radius 46.95 solar radii, implied by the fitted luminosity 5026.94 solar luminosities (fractional uncertainty 0.052) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 7,098 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 45556: effective temperature 7098 +/- 183 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.043). log g 1.6 from 1992ApJS...79..303L ("The chemical composition of Magellanic Cloud Cepheids and nonvariable supergiants.").

**Color.** A Planck spectrum at 7,098 K, because no archive holds a spectrum of this star (stis-ngsl: HD 80404 is not in the library; pulkovo: HR 3699 is not in the catalogue; kiehling: HR 3699 is not among its 60 stars; kharitonov: HR 3699 is not in the catalogue; burnashev: BS 3699 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it), through the CIE 1931 2° observer: #f2f1ff. Routes tried in order: stis-ngsl: HD 80404 is not in the library; pulkovo: HR 3699 is not in the catalogue; kiehling: HR 3699 is not among its 60 stars; kharitonov: HR 3699 is not in the catalogue; burnashev: BS 3699 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,098 K and log g 1.6 (u1 0.484, u2 0.214): a model, because no fit of this star's limb is used. Gravity: log g 1.6 from 1992ApJS...79..303L, the median of its 2 spectra; the 7 published values span log g 1.4 to 1.6, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Iota Carinae" (revision 1370780415) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
