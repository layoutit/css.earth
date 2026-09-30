# TIC 231084757

## Sources

Its oscillations, recorded by TESS, give 0.90 solar masses and 10.4 solar radii; APOGEE spectra give 4,831 K at its surface. It is also HD 270550. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4655623950483060608, distance 1,081 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 231084757 (observed by TESS): PARAM asteroseismic distance (pc) 1081.09375 (16th-84th percentiles 1066.210938-1095.742188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.843 ± 0.011 mas (76.0 standard errors), is not used. Radius 10.3864 +/- 0.2304 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 231084757 (observed by TESS): PARAM radius (solar radii) 10.386381 (16th-84th percentiles 10.150281-10.611033), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9026 +/- 0.0614 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 231084757 (observed by TESS): PARAM mass (solar masses) 0.902555 (16th-84th percentiles 0.84299-0.965734), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,831 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 231084757: APOGEE DR17 effective temperature 4831.426 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,831 K, because pARAM fits an extinction A_V = 0.34 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,831 K and log g 2.36 (u1 0.673, u2 0.115): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
