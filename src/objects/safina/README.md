# Safina

## Sources

Its brightness, measured band by band, gives 291 times the Sun's luminosity at 4,516 K, so 27.898 solar radii. It is also HD 218594, HR 8812, HIP 114341. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2386316510063903616, distance 83 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 114341: distance 82.988 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.018), at which the luminosity and radius hold; Gaia DR3's parallax, 12.671 ± 0.222 mas (57.0 standard errors), is not used. Radius 27.898 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 114341: radius 27.898 solar radii, implied by the fitted luminosity 290.845 solar luminosities (fractional uncertainty 0.058) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,516 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 114341: effective temperature 4516 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.068). log g 2.15 from 2007A&A...475.1003H ("Precise radial velocities of giant stars. III. Spectroscopic stellar  parameters.").

**Color.** Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 299 (BS 8812), through the CIE 1931 2° observer: #ffd9a9. Routes tried in order: stis-ngsl: HD 218594 is not in the library; pulkovo: HR 8812 is not in the catalogue; kiehling: HR 8812 is not among its 60 stars; kharitonov: HR 8812 is not in the catalogue; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; burnashev: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,516 K and log g 2.15 (u1 0.768, u2 0.043): a model, because no fit of this star's limb is used. Gravity: log g 2.15 from 2007A&A...475.1003H; the 5 published values span log g 2.02 to 2.34, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "88 Aquarii" (revision 1374547236) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
