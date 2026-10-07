# Zeta Serpentis

## Sources

Its disc spans 0.775 milliarcseconds, which gives 1.961 solar radii and 6,529 K at its surface. It is also HD 164259, HR 6710, HIP 88175. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4177224620176470912, distance 24 pc from Boyajian et al. (2012), ApJ 746, 101, HD 164259: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 42.44 +/- 0.33 mas, inverted; Gaia DR3's parallax, 43.482 ± 0.132 mas (328.5 standard errors), is not used. Radius 1.961 +/- 0.071 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 164259: radius in solar radii, from the limb-darkened angular diameter 0.775 +/- 0.027 mas (CHARA) and the Hipparcos parallax, 1.961 +/- 0.071 (https://doi.org/10.1088/0004-637X/746/1/101). Mass 1.429 +/- 0.013 solar masses from Boyajian et al. (2012), ApJ 746, 101, HD 164259: mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value), 1.429 +/- 0.013 (https://doi.org/10.1088/0004-637X/746/1/101). Temperature 6,529 K from Boyajian et al. (2012), ApJ 746, 101, HD 164259: effective temperature in K, from the angular diameter and the bolometric flux, 6529 +/- 118. log g 4.01 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4177224620176470912, through the CIE 1931 2° observer: #e2e6ff. Routes tried in order: stis-ngsl: HD 164259 is not in the library; pulkovo: HR 6710 is not in the catalogue; kiehling: HR 6710 is not among its 60 stars; kharitonov: HR 6710 is not in the catalogue; burnashev: BS 6710 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,529 K and log g 4.01 (u1 0.348, u2 0.315): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curve of sector 80 (June and July 2024; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). It is the light curve [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether it shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 80 gives a period of 1.25 d from the autocorrelation, whose peaks have a height of 0.42, a width of 0.45 and a fit of 0.98. The star's period is 1.25 d. The light varies by 0.08% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.02% about the light, whose own noise is 0.01%. Gaia DR3 lists 68 other stars within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of June and July 2024: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
