# Elnath

## Sources

Its disc spans 1.239 milliarcseconds, which gives 5.47 solar radii and 12,026 K at its surface. It is also HD 35497, HR 1791, HIP 25428. The introduction is generated from Baines et al. (2021), AJ 162, 198's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 25428 (SIMBAD HD 35497); placed by that row, not by a Gaia source, distance 41.05 pc from Baines et al. (2021), AJ 162, 198, HD 35497: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 24.36 +/- 0.34 mas, inverted. Radius 5.47 +/- 0.24 solar radii from Baines et al. (2021), AJ 162, 198, HD 35497: radius 5.47 +/- 0.24 solar radii (Table 5), from the limb-darkened angular diameter 1.239 +/- 0.052 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/ac2431). No mass is measured, so GM is 0, the records' unpublished value. Temperature 12,026 K from Baines et al. (2021), AJ 162, 198, HD 35497: effective temperature 12026 +/- 262 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 3.63 from Baines et al. (2021), AJ 162, 198, HD 35497: log g 3.63, from Allende Prieto & Lambert (1999), as the paper lists it beside the diameter (Table 4).

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Elnath is HR 1791., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 360: HR 1791; VizieR III/202 (6 levels apart at most, the threshold is 12). A catalogued companion does not blend it: Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists an occultation pair (OCC 115 Aa,Ab, 1930) that was never confirmed; Baines et al. (2021), AJ 162, 198, Sect. 4 fit Elnath as a single star, through the CIE 1931 2° observer: #afc6ff. Routes tried in order: stis-ngsl: HD 35497 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 1791 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 12,026 K and log g 3.63 (u1 0.177, u2 0.317): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
