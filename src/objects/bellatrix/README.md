# Bellatrix

## Sources

Its disc spans 0.72 milliarcseconds, which at its distance is 5.99 solar radii, and its surface is at 21,580 K. It is also HD 35468, HR 1790, HIP 25336. The introduction is generated from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 25336 (SIMBAD HD 35468); placed by that row, not by a Gaia source, distance 77.40 pc from Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, HIP 25336: the Hipparcos parallax (van Leeuwen 2007) the radius is computed with, 12.92 +/- 0.52 mas, inverted. Radius 5.99 +/- 0.41 solar radii from Computed here, not printed by a paper: 5.99 +/- 0.41 solar radii, from the limb-darkened angular diameter 0.72 +/- 0.04 mas of Hanbury Brown, Davis & Allen (1974), MNRAS 167, 121 (the Narrabri intensity interferometer; Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, Table 1, and the JMDC) and the Hipparcos parallax 12.92 +/- 0.52 mas (van Leeuwen 2007, XHIP) (https://doi.org/10.1093/mnras/167.1.121). No mass is measured, so GM is 0, the records' unpublished value. Temperature 21,580 K from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, HD 35468: effective temperature 21580 +/- 790 K (Table 6), from the measured angular diameter and the star's flux from the ultraviolet to the infrared. log g 3.51 from 2023ApJS..266...11B ("New Generation Stellar Spectral Libraries in the Optical and Near-infrared. I. The Recalibrated UVES-POP Library for Stellar Population Synthesis.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Bellatrix is HR 1790., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 359: HR 1790; VizieR III/202 (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #a7c1ff. Routes tried in order: stis-ngsl: HD 35468 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 1790 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 21,580 K and log g 3.51 (u1 0.113, u2 0.296): a model, because no fit of this star's limb is used. Gravity: log g 3.51 from 2023ApJS..266...11B; the 6 published values span log g 3.5093 to 4, across which the limb law changes by at most 2.7% of the centre brightness.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
