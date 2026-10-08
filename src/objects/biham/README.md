# Biham

## Sources

Its disc spans 0.862 milliarcseconds, which gives 2.623 solar radii and 7,951 K at its surface. It is also HD 210418, HR 8450, HIP 109427. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2720428303852574336, distance 28 pc from Boyajian et al. (2012), ApJ 746, 101, HD 210418: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 35.34 +/- 0.85 mas, inverted; Gaia DR3 gives it no parallax. Radius 2.623 +/- 0.083 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 210418: radius in solar radii, from the limb-darkened angular diameter 0.862 +/- 0.018 mas (CHARA) and the Hipparcos parallax, 2.623 +/- 0.083 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.858 +/- 0.024 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 210418: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.858 +/- 0.024 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 7,951 K from Boyajian et al. (2012), ApJ 746, 101, HD 210418: effective temperature in K, from the angular diameter and the bolometric flux, 7951 +/- 97. log g 3.87 from the mass and radius.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1042: HR 8450; VizieR III/202, through the CIE 1931 2° observer: #bfd1ff. Routes tried in order: stis-ngsl: HD 210418 is not in the library; pulkovo: HR 8450 is not in the catalogue; kiehling: HR 8450 is not among its 60 stars; burnashev: BS 8450 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,951 K and log g 3.87 (u1 0.322, u2 0.320): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 55 and 82 (the newest of August and September 2024; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 55 gives a period of 0.73 d from the autocorrelation, whose peaks have a height of 0.32, a width of 0.50 and a fit of 1.00; Sector 82 gives a period of 0.73 d from the autocorrelation, whose peaks have a height of 0.33, a width of 0.45 and a fit of 1.00. All 2 together give a period of 0.73 d from the autocorrelation, whose peaks have a height of 0.32, a width of 0.47 and a fit of 1.00, which is the star's period: 0.73 d. The light varies by 0.01% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.004% about the light, whose own noise is 0.002%. Gaia DR3 lists 4 other stars within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of August and September 2024: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
