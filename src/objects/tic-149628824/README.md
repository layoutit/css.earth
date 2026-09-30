# TIC 149628824

## Sources

Its oscillations, recorded by TESS, give 1.45 solar masses and 10.8 solar radii; APOGEE spectra give 4,839 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4756786510662352384, distance 1,131 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149628824 (observed by TESS): PARAM asteroseismic distance (pc) 1130.771484 (16th-84th percentiles 1122.324219-1139.521484), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 1.055 ± 0.021 mas (49.8 standard errors), is not used. Radius 10.7836 +/- 0.0454 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149628824 (observed by TESS): PARAM radius (solar radii) 10.783581 (16th-84th percentiles 10.745801-10.836665), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.447 +/- 0.0271 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149628824 (observed by TESS): PARAM mass (solar masses) 1.446991 (16th-84th percentiles 1.421507-1.475663), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,839 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149628824: APOGEE DR17 effective temperature 4838.6274 +/- 50 K (the catalogue's final uncertainty). log g 2.53 from the mass and radius.

**Colour.** A Planck spectrum at 4,839 K, because pARAM fits an extinction A_V = 0.18 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,839 K and log g 2.53 (u1 0.673, u2 0.116): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
