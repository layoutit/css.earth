# Merga

## Sources

Gaia's parallax, brightness and spectrum give it 2.6 solar radii and 1.59 solar masses (FLAME) and 6,249 K at its surface (GSP-Phot). It is also HD 130945, HR 5533, HIP 72487. The introduction is generated from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1589840624889560576, parallax 20.826 ± 0.035 mas (48.02 pc). Radius 2.627 (2.574 to 2.680) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 1.594 (1.554 to 1.634) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 6,249 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 1589840624889560576: teff_gspphot 6249.3184 K (16th-84th percentiles 6247.7983-6250.5947), the temperature FLAME used. log g 3.8 from the mass and radius.

**Color.** A Planck spectrum at 6,249 K, because gSP-Phot fits an extinction A_G = 0.00 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #fff6f7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,249 K and log g 3.8 (u1 0.375, u2 0.304): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curve of sector 23 (March and April 2020; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). It is among the light curves [Colman et al. (2024, AJ 167, 189)](https://arxiv.org/abs/2402.14954) searched for rotation, and the star's row in their table (VizieR J/AJ/167/189/fig12) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Colman et al. (2024, AJ 167, 189) ask a sector's light to pass both of the paper's random-forest classifiers (rotation detected; period accurate) with a Lomb-Scargle amplitude of at least 0.01. Their table (VizieR J/AJ/167/189/fig12) gives a rotation period of 4.18 d, the highest peak of the Lomb-Scargle periodogram of the star's one sector among sectors 1 to 26, which passed both of the paper's classifiers: the star's period is 4.18 d, as published, and no criteria were applied to it here. The light varies by 0.09% (the range between its 5th and 95th percentiles, as the table prints it). On the paper's blind test set its first classifier turned away 82% of the stars with no rotation and its second 95% of the inaccurate periods. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 1 of the star's 3 sectors, and Holcomb et al. (2022) ask for at least 2. The star's record holds 3.7 d from the catalogues. The map's light curve leaves a scatter of 0.01% about the light, whose own noise is 0.01%. Gaia DR3 lists 1 other star within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "38 Boötis" (revision 1328134388) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 15.8°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of March and April 2020: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
