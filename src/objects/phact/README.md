# Phact

## Sources

Its brightness, measured band by band, gives 412 times the Sun's luminosity at 8,054 K, so 10.435 solar radii. It is also HD 37795, HR 1956, HIP 26634. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2900546759663847168, distance 80 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 26634: distance 80.128 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.029), at which the luminosity and radius hold; Gaia DR3's parallax, 11.401 ± 0.445 mas (25.6 standard errors), is not used. Radius 10.435 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 26634: radius 10.435 solar radii, implied by the fitted luminosity 411.675 solar luminosities (fractional uncertainty 0.874) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,054 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 26634: effective temperature 8054 +/- 3803 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.31). log g 3.5 from 2018MNRAS.474.5287A ("Stellar parameters and H {alpha} line profile variability of Be stars in the BeSOS survey.").

**Color.** Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 69 (BS 1956), through the CIE 1931 2° observer: #b1c7ff. Routes tried in order: stis-ngsl: HD 37795 is not in the library; pulkovo: HR 1956 is not in the catalogue; kiehling: HR 1956 is not among its 60 stars; kharitonov: HR 1956 is not in the catalogue; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; burnashev: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,054 K and log g 3.5 (u1 0.354, u2 0.298): a model, because no fit of this star's limb is used. Gravity: log g 3.5 from 2018MNRAS.474.5287A; the 3 published values span log g 3.2 to 3.5, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alpha Columbae" (revision 1370772920) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
