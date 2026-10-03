# Pollux

## Sources

Its disc spans 8.134 milliarcseconds, which gives 9.06 solar radii and 4,586 K at its surface. It is also HD 62509, HR 2990, HIP 37826. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 37826 (SIMBAD HD 62509); placed by that row, not by a Gaia source, distance 10.36 pc from Baines et al. (2018), AJ 155, 30, HD 62509: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 96.54 +/- 0.27 mas, inverted. Radius 9.06 +/- 0.03 solar radii from Baines et al. (2018), AJ 155, 30, HD 62509: radius 9.06 +/- 0.03 solar radii (Table 5), from the limb-darkened angular diameter 8.134 +/- 0.013 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 1.91 +/- 0.09 solar masses from Hatzes et al. (2012), A&A 543, A98, abstract: M = 1.91 +/- 0.09 solar masses from the p-mode frequency spacing (7.14 +/- 0.12 microHz) and the interferometric radius (https://doi.org/10.1051/0004-6361/201219332). Temperature 4,586 K from Baines et al. (2018), AJ 155, 30, HD 62509: effective temperature 4586 +/- 57 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.8 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Pollux is HR 2990., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 488: HR 2990; VizieR III/202 (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe4c3. Routes tried in order: stis-ngsl: HD 62509 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 2990 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,586 K and log g 2.8 (u1 0.756, u2 0.049): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
