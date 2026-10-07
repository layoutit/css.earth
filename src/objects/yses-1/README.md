# YSES 1

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

YSES 1 is a 17-million-year-old analogue of the young Sun. Two giant planets orbit it far out; JWST has seen silicate clouds and a dusty disc around them.

## Sources

**Placement.** Gaia DR3 source 5864061893213196032 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-yses-1.json)).

**Radius, temperature and mass.** 4,573 ± 10 K, 1.00 ± 0.02 solar masses and 1.01 ± 0.02 solar radii as the ESO SupJup survey tabulates them (Zhang et al. [2024](https://arxiv.org/abs/2409.16660), Table 1) from Bohn et al. ([2020](https://arxiv.org/abs/2007.10991), ApJL 898, L16) and Gaia. Model values: the disc is not measured. Also catalogued as TYC 8998-760-1.

**Radial velocity.** 12.94 ± 0.03 km/s from VLT/CRIRES+ (Zhang et al. 2024, section 5.5); Gaia DR3 gives none.

**The second planet.** YSES 1 c, 6 Jupiter masses at about 320 au (Bohn et al. 2020), is not built: its astrometry does not yet constrain an orbit (Roberts et al. 2025, section 5), and a planet here is placed by its orbit ([ledger](investigations.json)).

**Color dataset.** The color of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)). Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 4,573 K (the record) and log g 4.43 (from the record's mass and radius (packages/astronomy/data/bodies/yses-1.json)): a model, since no fit of this star's limb exists.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curve of sector 11 (April and May 2019; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). It is among the light curves [Colman et al. (2024, AJ 167, 189)](https://arxiv.org/abs/2402.14954) searched for rotation, and the star's row in their table (VizieR J/AJ/167/189/fig12) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. The four stars in the app, headless Chromium at 800 × 600 on this version: each is drawn in its Gaia spectrum's color, with its planet's orbit crossing the view.

**Brightness from TESS.** Colman et al. (2024, AJ 167, 189) ask a sector's light to pass both of the paper's random-forest classifiers (rotation detected; period accurate) with a Lomb-Scargle amplitude of at least 0.01. Their table (VizieR J/AJ/167/189/fig12) gives a rotation period of 5.46 d, the highest peak of the Lomb-Scargle periodogram of the star's one sector among sectors 1 to 26, which passed both of the paper's classifiers: the star's period is 5.46 d, as published, and no criteria were applied to it here. The light varies by 5.3% (the range between its 5th and 95th percentiles, as the table prints it). On the paper's blind test set its first classifier turned away 82% of the stars with no rotation and its second 95% of the inaccurate periods. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: The star's sectors together do not give a valid period: The autocorrelation of all the sectors together gives 5.37 d with peaks of height 0.28, width 0.44 and fit 0.88, outside what Holcomb et al. (2022) accept (a height over a quarter of the width, a width between 0.4 and 0.6, a fit over 0.9). The star's record holds 5.5 d from the catalogues. The map's light curve leaves a scatter of 0.42% about the light, whose own noise is 0.10%. Gaia DR3 lists 912 other stars within 63 arcseconds, with 64% of their light and the star's together.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- The limb darkening is a model: the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 4,573 K (the record) and log g 4.43 (from the record's mass and radius (packages/astronomy/data/bodies/yses-1.json)).

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of April and May 2019: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
