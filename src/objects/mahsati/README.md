# Mahsati

## Sources

Its brightness, measured band by band, gives 13 times the Sun's luminosity at 4,956 K, so 4.918 solar radii. It is also HD 152581, HIP 82651. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4448227641977175296, distance 168 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 82651: distance 167.89 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.046), at which the luminosity and radius hold; Gaia DR3's parallax, 6.080 ± 0.020 mas (307.6 standard errors), is not used. Radius 4.918 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 82651: radius 4.918 solar radii, implied by the fitted luminosity 13.107 solar luminosities (fractional uncertainty 0.068) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,956 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 82651: effective temperature 4956 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.04). log g 3.28 from 2024A&A...691A..53S ("SWEET-Cat: A view on the planetary mass-radius relation.").

**Color.** Gaia DR3 XP spectrum, source 4448227641977175296, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: HD 152581 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,956 K and log g 3.28 (u1 0.650, u2 0.131): a model, because no fit of this star's limb is used. Gravity: log g 3.28 from 2024A&A...691A..53S; the 8 published values span log g 3 to 3.47, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
