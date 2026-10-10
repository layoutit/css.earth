# Merope

## Sources

Its brightness, measured band by band, gives 283 times the Sun's luminosity at 7,913 K, so 8.963 solar radii. It is also HD 23480, HR 1156, HIP 17608. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 65205373152172032, distance 135 pc from Hunt & Reffert (2023), Improving the open cluster census. II. An all-sky cluster catalogue with Gaia DR3, A&A 673, A114; CDS J/A+A/673/A114, Table 3 (clusters), Melotte_22: dist50 134.84134308 pc, the distance of the Pleiades, of which Merope is a member; its own parallax (McDonald, Zijlstra & Watson 2017 adopt 116.55 pc from Gaia DR1 or the Hipparcos reduction of van Leeuwen 2007) is less certain than the cluster's depth (half its members within 2.70 pc of the centre), and the Hipparcos-era parallaxes of the bright Pleiades are the ones the cluster's distance controversy showed biased; Gaia DR3's parallax, 7.067 ± 0.286 mas (24.7 standard errors), is not used. Radius 8.963 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17608: radius 7.747 solar radii, implied by the fitted luminosity 211.434 solar luminosities (fractional uncertainty 0.783) and temperature; scaled from the paper's distance, 116.55 pc, to the cluster's, 134.84 pc: at a fixed temperature the radius grows with the distance, so 7.747 x 134.84/116.55 = 8.963 solar radii (luminosity 283.0) (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 7,913 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17608: effective temperature 7913 +/- 3358 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.448). log g 2.92 from SIMBAD's compilation of spectroscopic measurements (mesFe_h): log g 2.92 from 2001A&A...378..861C; the 2 published values span log g 2.92 to 4, across which the limb law changes by at most 2.6% of the centre brightness.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 215: HR 1156; VizieR III/202, through the CIE 1931 2° observer: #b1c6ff. Routes tried in order: stis-ngsl: HD 23480 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 1156 is not in the catalogue; kiehling: HR 1156 is not among its 60 stars; burnashev: BS 1156 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,913 K and log g 2.92 (u1 0.371, u2 0.289): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-10 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Merope (star)" (revision 1374605605) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
