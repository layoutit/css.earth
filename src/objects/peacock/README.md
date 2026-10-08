# Peacock

## Sources

Its disc spans 0.8 milliarcseconds, which at its distance is 4.72 solar radii, and its surface is at 17,880 K. It is also HD 193924, HR 7790, HIP 100751. The introduction is generated from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 100751 (SIMBAD HD 193924); placed by that row, not by a Gaia source, distance 54.83 pc from Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, HIP 100751: the Hipparcos parallax (van Leeuwen 2007) the radius is computed with, 18.24 +/- 0.52 mas, inverted. Radius 4.72 +/- 0.32 solar radii from Computed here, not printed by a paper: 4.72 +/- 0.32 solar radii, from the limb-darkened angular diameter 0.8 +/- 0.05 mas of Hanbury Brown, Davis & Allen (1974), MNRAS 167, 121 (the Narrabri intensity interferometer; Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, Table 1, and the JMDC) and the Hipparcos parallax 18.24 +/- 0.52 mas (van Leeuwen 2007, XHIP) (https://doi.org/10.1093/mnras/167.1.121). No mass is measured, so GM is 0, the records' unpublished value. Temperature 17,880 K from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, HD 193924: effective temperature 17880 +/- 680 K (Table 6), from the measured angular diameter and the star's flux from the ultraviolet to the infrared. log g 3.94 from 2015ApJ...804..146D ("The ages of early-type stars: Stromgren photometric methods calibrated, validated, tested, and applied to hosts and prospective hosts of directly imaged exoplanets.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Peacock is HR 7790., cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 269 (BS 7790) (1 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #a8c1ff. Routes tried in order: stis-ngsl: HD 193924 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 7790 is not among its 60 stars; kharitonov: HR 7790 is not in the catalogue; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 17,880 K and log g 3.94 (u1 0.131, u2 0.271): a model, because no fit of this star's limb is used. Gravity: log g 3.94 +/- 0.14 from 2015ApJ...804..146D, measured from the star's Stroemgren photometry: SIMBAD's compilation holds no spectroscopic gravity of this star.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 1 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
