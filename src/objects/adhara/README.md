# Adhara

## Sources

Its disc spans 0.8 milliarcseconds, which at its distance is 10.7 solar radii, and its surface is at 20,990 K. It is also HD 52089, HR 2618, HIP 33579. The introduction is generated from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 33579 (SIMBAD HD 52089); placed by that row, not by a Gaia source, distance 124 pc from Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, HIP 33579: the Hipparcos parallax (van Leeuwen 2007) the radius is computed with, 8.05 +/- 0.14 mas, inverted. Radius 10.7 +/- 0.69 solar radii from Computed here, not printed by a paper: 10.7 +/- 0.69 solar radii, from the limb-darkened angular diameter 0.8 +/- 0.05 mas of Hanbury Brown, Davis & Allen (1974), MNRAS 167, 121 (the Narrabri intensity interferometer; Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, Table 1, and the JMDC) and the Hipparcos parallax 8.05 +/- 0.14 mas (van Leeuwen 2007, XHIP) (https://doi.org/10.1093/mnras/167.1.121). No mass is measured, so GM is 0, the records' unpublished value. Temperature 20,990 K from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, HD 52089: effective temperature 20990 +/- 760 K (Table 6), from the measured angular diameter and the star's flux from the ultraviolet to the infrared. log g 3.5 from 2025ApJ...979...21S ("Epsilon Canis Majoris: The Brightest Extreme-ultraviolet Source with Surprisingly Low Interstellar Absorption.").

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 52089: 168-1020 nm, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Adhara is HR 2618. (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #a3bcff. Routes tried in order: gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 2618 is not among its 60 stars; kharitonov: HR 2618 is not in the catalogue; burnashev: found, not needed after the color and its cross-check; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 20,990 K and log g 3.5 (u1 0.118, u2 0.293): a model, because no fit of this star's limb is used. Gravity: log g 3.5 from 2025ApJ...979...21S; the 6 published values span log g 3.29 to 3.65, across which the limb law changes by at most 1.8% of the centre brightness.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
