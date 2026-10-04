# Arkab Posterior

## Sources

Its brightness, measured band by band, gives 29 times the Sun's luminosity at 6,615 K, so 4.106 solar radii. It is also HD 181623, HR 7343, HIP 95294. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6664407333374099968, distance 41 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 95294: distance 41.135 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.008), at which the luminosity and radius hold; Gaia DR3's parallax, 23.361 ± 0.274 mas (85.1 standard errors), is not used. Radius 4.106 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 95294: radius 4.106 solar radii, implied by the fitted luminosity 28.998 solar luminosities (fractional uncertainty 0.12) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 6,615 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 95294: effective temperature 6615 +/- 451 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.171). log g 3.55 from 2003A&A...398.1121E ("Automated spectroscopic abundances of A and F-type stars using echelle spectrographs II. Abundances of 140 A-F stars from  ELODIE and CORALIE.").

**Color.** A Planck spectrum at 6,615 K, because no archive holds a spectrum of this star (stis-ngsl: HD 181623 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 7343 is not in the catalogue; kiehling: HR 7343 is not among its 60 stars; kharitonov: HR 7343 is not in the catalogue; burnashev: BS 7343 is not in part2), through the CIE 1931 2° observer: #fdf8ff. Routes tried in order: stis-ngsl: HD 181623 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 7343 is not in the catalogue; kiehling: HR 7343 is not among its 60 stars; kharitonov: HR 7343 is not in the catalogue; burnashev: BS 7343 is not in part2; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,615 K and log g 3.55 (u1 0.340, u2 0.319): a model, because no fit of this star's limb is used. Gravity: log g 3.55 from 2003A&A...398.1121E; the 1 published value span log g 3.55 to 3.55, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta2 Sagittarii" (revision 1374781471) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
