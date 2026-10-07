# Alnair

## Sources

Its disc spans 1.02 milliarcseconds, which at its distance is 3.4 solar radii, and its surface is at 14,050 K. It is also HD 209952, HR 8425, HIP 109268. The introduction is generated from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6560604777055249536, distance 31 pc from Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, HIP 109268: the Hipparcos parallax (van Leeuwen 2007) the radius is computed with, 32.29 +/- 0.21 mas, inverted; Gaia DR3 gives it no parallax. Radius 3.4 +/- 0.23 solar radii from Computed here, not printed by a paper: 3.4 +/- 0.23 solar radii, from the limb-darkened angular diameter 1.02 +/- 0.07 mas of Hanbury Brown, Davis & Allen (1974), MNRAS 167, 121 (the Narrabri intensity interferometer; Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, Table 1, and the JMDC) and the Hipparcos parallax 32.29 +/- 0.21 mas (van Leeuwen 2007, XHIP) (https://doi.org/10.1093/mnras/167.1.121). No mass is measured, so GM is 0, the records' unpublished value. Temperature 14,050 K from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, HD 209952: effective temperature 14050 +/- 540 K (Table 6), from the measured angular diameter and the star's flux from the ultraviolet to the infrared. No surface gravity of this star is published.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Alnair is HR 8425., cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 285 (BS 8425) (0 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #aec5ff. Routes tried in order: stis-ngsl: HD 209952 is not in the library; kiehling: HR 8425 is not among its 60 stars; kharitonov: HR 8425 is not in the catalogue; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** No limb darkening is drawn: no surface gravity is known: the mass is unmeasured, no spectroscopic log g is published and the spec gives no range for its class.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 0 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
