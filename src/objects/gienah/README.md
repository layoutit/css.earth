# Gienah

## Sources

Its disc spans 0.75 milliarcseconds, which at its distance is 3.8 solar radii, and its surface is at 12,450 K. It is also HD 106625, HR 4662, HIP 59803. The introduction is generated from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 59803 (SIMBAD HD 106625); placed by that row, not by a Gaia source, distance 47.10 pc from Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, HIP 59803: the Hipparcos parallax (van Leeuwen 2007) the radius is computed with, 21.23 +/- 0.2 mas, inverted. Radius 3.8 +/- 0.31 solar radii from Computed here, not printed by a paper: 3.8 +/- 0.31 solar radii, from the limb-darkened angular diameter 0.75 +/- 0.06 mas of Hanbury Brown, Davis & Allen (1974), MNRAS 167, 121 (the Narrabri intensity interferometer; Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, Table 1, and the JMDC) and the Hipparcos parallax 21.23 +/- 0.2 mas (van Leeuwen 2007, XHIP) (https://doi.org/10.1093/mnras/167.1.121). No mass is measured, so GM is 0, the records' unpublished value. Temperature 12,450 K from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, HD 106625: effective temperature 12450 +/- 530 K (Table 6), from the measured angular diameter and the star's flux from the ultraviolet to the infrared. No surface gravity of this star is published.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Gienah is HR 4662., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 613: HR 4662; VizieR III/202 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #b1c8ff. Routes tried in order: stis-ngsl: HD 106625 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 4662 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** No limb darkening is drawn: no surface gravity is known: the mass is unmeasured, no spectroscopic log g is published and the spec gives no range for its class.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
