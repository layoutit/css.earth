# Miaplacidus

## Sources

Its disc spans 1.59 milliarcseconds, which at its distance is 5.93 solar radii, and its surface is at 9,240 K. It is also HD 80007, HR 3685, HIP 45238. The introduction is generated from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 45238 (SIMBAD HD 80007); placed by that row, not by a Gaia source, distance 34.70 pc from Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, HIP 45238: the Hipparcos parallax (van Leeuwen 2007) the radius is computed with, 28.82 +/- 0.11 mas, inverted. Radius 5.93 +/- 0.26 solar radii from Computed here, not printed by a paper: 5.93 +/- 0.26 solar radii, from the limb-darkened angular diameter 1.59 +/- 0.07 mas of Hanbury Brown, Davis & Allen (1974), MNRAS 167, 121 (the Narrabri intensity interferometer; Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, Table 1, and the JMDC) and the Hipparcos parallax 28.82 +/- 0.11 mas (van Leeuwen 2007, XHIP) (https://doi.org/10.1093/mnras/167.1.121). No mass is measured, so GM is 0, the records' unpublished value. Temperature 9,240 K from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, HD 80007: effective temperature 9240 +/- 220 K (Table 6), from the measured angular diameter and the star's flux from the ultraviolet to the infrared. log g 3.16 from 2003AJ....125.1598L ("Spectroscopy of new high proper motion stars in the northern sky. I. New nearby stars, new high-velocity stars, and an enhanced  classification scheme for M dwarfs.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Miaplacidus is HR 3685., cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 129 (BS 3685) (1 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #bcd0ff. Routes tried in order: stis-ngsl: HD 80007 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 3685 is not among its 60 stars; kharitonov: HR 3685 is not in the catalogue; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 9,240 K and log g 3.16 (u1 0.262, u2 0.323): a model, because no fit of this star's limb is used. Gravity: log g 3.16 from 2003AJ....125.1598L; the 1 published value span log g 3.16 to 3.16, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 1 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
