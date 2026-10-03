# Dubhe

## Sources

Its disc spans 6.419 milliarcseconds, which gives 17.03 solar radii and 5,012 K at its surface. It is also HD 95689, HR 4301, HIP 54061. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 54061 (SIMBAD HD 95689); placed by that row, not by a Gaia source, distance 37.68 pc from Baines et al. (2018), AJ 155, 30, HD 95689: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 26.54 +/- 0.48 mas, inverted. Radius 17.03 +/- 0.13 solar radii from Baines et al. (2018), AJ 155, 30, HD 95689: radius 17.03 +/- 0.13 solar radii (Table 5), from the limb-darkened angular diameter 6.419 +/- 0.041 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 3.44 +/- 0.11 solar masses from Baines et al. (2018), AJ 155, 30, HD 95689: mass 3.44 +/- 0.11 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 5,012 K from Baines et al. (2018), AJ 155, 30, HD 95689: effective temperature 5012 +/- 65 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.51 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Dubhe is HR 4301., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 588: HR 4301; VizieR III/202 (7 levels apart at most, the threshold is 12). Of the companion a double-star catalogue lists: the spectrum includes Dubhe's companion, which is not drawn: Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists WDS 11037+6145 BU 1077 AB 0.8 arcsec apart at magnitudes 2.02 and 4.95, so it gives 6.3% of the light and can move a color channel by 16 levels of 255 at most; a Planck color at the star's NPOI temperature differs from the measured one by 25 levels, so the measurement is kept, through the CIE 1931 2° observer: #ffe1b7. Routes tried in order: stis-ngsl: HD 95689 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 4301 is not among its 60 stars; burnashev: BS 4301 is not in part2; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,012 K and log g 2.51 (u1 0.621, u2 0.153): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
