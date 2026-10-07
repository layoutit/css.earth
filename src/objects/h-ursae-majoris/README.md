# h Ursae Majoris

## Sources

Its disc spans 1.133 milliarcseconds, which gives 2.902 solar radii and 6,693 K at its surface. It is also HD 81937, HR 3757, HIP 46733. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1064092789129355136, distance 24 pc from Boyajian et al. (2012), ApJ 746, 101, HD 81937: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 41.99 +/- 0.16 mas, inverted; Gaia DR3's parallax, 42.090 ± 0.162 mas (260.4 standard errors), is not used. Radius 2.902 +/- 0.026 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 81937: radius in solar radii, from the limb-darkened angular diameter 1.133 +/- 0.009 mas (CHARA) and the Hipparcos parallax, 2.902 +/- 0.026 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.824 +/- 0.016 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 81937: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.824 +/- 0.016 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,693 K from Boyajian et al. (2012), ApJ 746, 101, HD 81937: effective temperature in K, from the angular diameter and the bolometric flux, 6693 +/- 45. log g 3.77 from the mass and radius.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 539: HR 3757; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 1064092789129355136 (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #dee4ff. Routes tried in order: stis-ngsl: HD 81937 is not in the library; pulkovo: HR 3757 is not in the catalogue; kiehling: HR 3757 is not among its 60 stars; burnashev: BS 3757 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,693 K and log g 3.77 (u1 0.334, u2 0.321): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 20, 21, 47 and 74 (the newest of January 2024; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 20 gives a period of 1.68 d from the autocorrelation, whose peaks have a height of 0.34, a width of 0.42 and a fit of 0.98; Sector 21 gives a period of 0.81 d from the autocorrelation, whose peaks have a height of 0.42, a width of 0.43 and a fit of 0.99; Sector 47 gives a period of 0.82 d from the autocorrelation, whose peaks have a height of 0.32, a width of 0.49 and a fit of 0.98; Sector 74 gives a period of 0.83 d from the autocorrelation, whose peaks have a height of 0.36, a width of 0.48 and a fit of 0.99. All 4 together give a period of 0.80 d from the autocorrelation, whose peaks have a height of 0.35, a width of 0.51 and a fit of 0.98, which is the star's period: 0.8 d. The light varies by 0.05% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.02% about the light, whose own noise is 0.01%. Gaia DR3 lists 7 other stars within 63 arcseconds, with 1.2% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of January 2024: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
