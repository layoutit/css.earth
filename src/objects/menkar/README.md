# Menkar

## Sources

Its disc spans 12.2 milliarcseconds, which gives 100.206 solar radii and 3,738 K at its surface. It is also HD 18884, HR 911, HIP 14135. The introduction is generated from Soubiran et al. (2024), A&A 682, A145's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 14135 (SIMBAD HD 18884); placed by that row, not by a Gaia source, distance 76.39 pc from Soubiran et al. (2024), A&A 682, A145, HD 18884: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with, 13.09 +/- 0.44 mas, inverted. Radius 100.206 +/- 3.384 solar radii from Soubiran et al. (2024), A&A 682, A145, HD 18884: radius 100.206 +/- 3.384 solar radii, from the limb-darkened angular diameter 12.2 +/- 0.04 mas (measured in 2006A&A...460..855W, as the table lists it) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.1051/0004-6361/202347136). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,738 K from Soubiran et al. (2024), A&A 682, A145, HD 18884: effective temperature 3738 +/- 170 K, from the angular diameter and the bolometric flux of the paper's SED fit. log g 0.66 from Soubiran et al. (2024), A&A 682, A145, HD 18884: log g 0.66 +/- 0.07, the paper's own, from Newton's law with its radius and a mass from evolution models.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 158: HR 911; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 25 (BS 911), the widest of its 2 scans (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffce84. Routes tried in order: stis-ngsl: HD 18884 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: HR 911 is not in the catalogue; kiehling: HR 911 is not among its 60 stars; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,738 K and log g 0.66 (u1 1.015, u2 -0.171): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
