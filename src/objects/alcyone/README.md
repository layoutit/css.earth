# Alcyone

## Sources

Its brightness, measured band by band, gives 1,004 times the Sun's luminosity at 8,392 K, so 15.013 solar radii. It is also HD 23630, HR 1165, HIP 17702. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 66714384142368256, distance 135 pc from Hunt & Reffert (2023), Improving the open cluster census. II. An all-sky cluster catalogue with Gaia DR3, A&A 673, A114; CDS J/A+A/673/A114, Table 3 (clusters), Melotte_22: dist50 134.84134308 pc, the distance of the Pleiades, of which Alcyone is a member; its own parallax (McDonald, Zijlstra & Watson 2017 adopt 123.609 pc from Gaia DR1 or the Hipparcos reduction of van Leeuwen 2007) is less certain than the cluster's depth (half its members within 2.70 pc of the centre), and the Hipparcos-era parallaxes of the bright Pleiades are the ones the cluster's distance controversy showed biased; Gaia DR3 gives it no parallax. Radius 15.013 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17702: radius 13.762 solar radii, implied by the fitted luminosity 843.922 solar luminosities (fractional uncertainty 0.91) and temperature; scaled from the paper's distance, 123.609 pc, to the cluster's, 134.84 pc: at a fixed temperature the radius grows with the distance, so 13.762 x 134.84/123.609 = 15.013 solar radii (luminosity 1004.3) (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,392 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 17702: effective temperature 8392 +/- 4070 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.113). log g 4 from SIMBAD's compilation of spectroscopic measurements (mesFe_h): log g 4 from 2001A&A...378..861C; the 1 published value span log g 4 to 4, across which the limb law changes by at most 0.0% of the centre brightness.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 222: HR 1165; VizieR III/202. Of the companion a double-star catalogue lists: The Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists Alcyone as WDS 03475+2406 OCC 251 Aa,Ab, a pair found by lunar occultation whose separation is not measured, of magnitudes 3 and 4.6: no spectrograph separates them, so the measured spectrum, and the color, are of both, the companion giving about 18.6% of the light., through the CIE 1931 2° observer: #aec4ff. Routes tried in order: stis-ngsl: HD 23630 is not in the library; pulkovo: HR 1165 is not in the catalogue; kiehling: HR 1165 is not among its 60 stars; burnashev: BS 1165 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,392 K and log g 4 (u1 0.321, u2 0.310): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-10 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alcyone (star)" (revision 1374779784) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
