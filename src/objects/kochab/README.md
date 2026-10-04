# Kochab

## Sources

Its disc spans 10.229 milliarcseconds, which gives 44.13 solar radii and 4,008 K at its surface. It is also HD 131873, HR 5563, HIP 72607. The introduction is generated from Baines et al. (2021), AJ 162, 198's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 72607 (SIMBAD HD 131873); placed by that row, not by a Gaia source, distance 40.15 pc from Baines et al. (2021), AJ 162, 198, HD 131873: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 24.91 +/- 0.12 mas, inverted. Radius 44.13 +/- 0.22 solar radii from Baines et al. (2021), AJ 162, 198, HD 131873: radius 44.13 +/- 0.22 solar radii (Table 5), from the limb-darkened angular diameter 10.229 +/- 0.012 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/ac2431). Mass 1.3 +/- 0.3 solar masses from Tarrant et al. (2008), A&A 483, L43, abstract: 1.3 +/- 0.3 solar masses from the large frequency spacing, 0.48 microhertz, of two oscillation modes in SMEI photometry, with the star's known parameters (https://doi.org/10.1051/0004-6361:200809738). Temperature 4,008 K from Baines et al. (2021), AJ 162, 198, HD 131873: effective temperature 4008 +/- 37 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 1.26 from the mass and radius.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 131873: 168-1020 nm, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Kochab is HR 5563. (1 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcf92. Routes tried in order: gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 5563 is not among its 60 stars; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 5563 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,008 K and log g 1.26 (u1 0.932, u2 -0.094): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 1 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
