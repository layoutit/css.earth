# Mirfak

## Sources

Its disc spans 3.18 milliarcseconds, which gives 53.07 solar radii and 5,859 K at its surface. It is also HD 20902, HR 1017, HIP 15863. The introduction is generated from Baines et al. (2021), AJ 162, 198's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 15863 (SIMBAD HD 20902); placed by that row, not by a Gaia source, distance 155 pc from Baines et al. (2021), AJ 162, 198, HD 20902: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 6.44 +/- 0.17 mas, inverted. Radius 53.07 +/- 1.45 solar radii from Baines et al. (2021), AJ 162, 198, HD 20902: radius 53.07 +1.37/-1.45 solar radii (Table 5), from the limb-darkened angular diameter 3.18 +/- 0.008 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/ac2431). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,859 K from Baines et al. (2021), AJ 162, 198, HD 20902: effective temperature 5859 +/- 41 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 1.31 from Baines et al. (2021), AJ 162, 198, HD 20902: log g 1.31, from Prugniel et al. (2011), as the paper lists it beside the diameter (Table 4).

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Mirfak is HR 1017., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 180: HR 1017; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fbf7ff. Routes tried in order: stis-ngsl: HD 20902 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 1017 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,859 K and log g 1.31 (u1 0.464, u2 0.232): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
