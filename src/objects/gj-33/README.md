# GJ 33

## Sources

Interferometry gives it 0.6954 solar radii; with its total light, that makes its surface 4,950 K. It is also HD 4628, HR 222, HIP 3765. The introduction is generated from Boyajian et al. (2012), ApJ 757, 112's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2552925644460225152, parallax 134.495 ± 0.058 mas (7.44 pc). Radius 0.6954 +/- 0.0041 solar radii from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 33: radius in solar radii, 0.6954 +/- 0.0041, from this work (CHARA) (https://doi.org/10.1088/0004-637X/757/2/112). Mass 0.753 solar masses from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 33: mass 0.753 solar masses from the K-band mass-luminosity relation of Henry & McCarthy (1993), not a dynamical mass (https://doi.org/10.1088/0004-637X/757/2/112). Temperature 4,950 K from Boyajian et al. (2012), ApJ 757, 112, Table 6, GJ 33: effective temperature in K, 4950 +/- 14, from this work (CHARA). log g 4.63 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2552925644460225152, through the CIE 1931 2° observer: #ffe2d2. Routes tried in order: stis-ngsl: HD 4628 is not in the library; pulkovo: HR 222 is not in the catalogue; kiehling: HR 222 is not among its 60 stars; kharitonov: HR 222 is not in the catalogue; burnashev: BS 222 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,950 K and log g 4.63 (u1 0.671, u2 0.108): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 8 (January to March 2016; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is the light curve [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 8 the light varies by 0.12% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give 22.12, 21.58 and 22.38 d, and the periodogram's peak has a height of 0.46: within what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three within five days of each other, a peak over 0.3). The period is their mean, 22.02 d. Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The light repeats every 22.02 d, half the 39 d the star's record holds from the catalogues, so the star is taken to turn once in two of them. The map's light curve leaves a scatter of 0.02% about the light, whose own noise is 0.01%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of January to March 2016: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
