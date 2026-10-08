# Alnilam

## Sources

Its disc spans 0.69 milliarcseconds, which at its distance is 45 solar radii, and its surface is at 24,820 K. It is also HD 37128, HR 1903, HIP 26311. The introduction is generated from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 26311 (SIMBAD HD 37128); placed by that row, not by a Gaia source, distance 606 pc from Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, HIP 26311: the Hipparcos parallax (van Leeuwen 2007) the radius is computed with, 1.65 +/- 0.45 mas, inverted. Radius 45 +/- 13 solar radii from Computed here, not printed by a paper: 45 +/- 13 solar radii, from the limb-darkened angular diameter 0.69 +/- 0.04 mas of Hanbury Brown, Davis & Allen (1974), MNRAS 167, 121 (the Narrabri intensity interferometer; Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, Table 1, and the JMDC) and the Hipparcos parallax 1.65 +/- 0.45 mas (van Leeuwen 2007, XHIP) (https://doi.org/10.1093/mnras/167.1.121). No mass is measured, so GM is 0, the records' unpublished value. Temperature 24,820 K from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, HD 37128: effective temperature 24820 +/- 920 K (Table 6), from the measured angular diameter and the star's flux from the ultraviolet to the infrared. log g 2.89 from 2024A&A...687A.228D ("The IACOB project X. Large-scale quantitative spectroscopic analysis of Galactic luminous blue stars.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 381: HR 1903; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 66 (BS 1903) (8 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #a6c1ff. Routes tried in order: stis-ngsl: HD 37128 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: HR 1903 is not in the catalogue; kiehling: HR 1903 is not among its 60 stars; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Howarth (2011), MNRAS 413, 1515 computes from ATLAS9 model atmospheres for the Bessell V band at 24,820 K and log g 2.89, read between the models t24000g28, t24000g30, t25000g28, t25000g30 (u1 0.128, u2 0.390): a model, because no fit of this star's limb is used. Gravity: log g 2.89 from 2024A&A...687A.228D; the 3 published values span log g 2.85 to 3, across which the limb law changes by at most 2.3% of the centre brightness.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 8 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
