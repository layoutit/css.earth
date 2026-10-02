# TIC 279569902

## Sources

Its oscillations, recorded by TESS, give 1.43 solar masses and 25.2 solar radii; APOGEE spectra give 4,403 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5480852369663558272, distance 1,629 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279569902 (observed by TESS): PARAM asteroseismic distance (pc) 1629.335938 (16th-84th percentiles 1586.816406-1673.144531), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.670 ± 0.011 mas (60.8 standard errors), is not used. Radius 25.2159 +/- 1.229 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279569902 (observed by TESS): PARAM radius (solar radii) 25.215881 (16th-84th percentiles 24.082058-26.539966), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4324 +/- 0.1841 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279569902 (observed by TESS): PARAM mass (solar masses) 1.432406 (16th-84th percentiles 1.271067-1.639215), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,403 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279569902: APOGEE DR17 effective temperature 4402.9956 +/- 50 K (the catalogue's final uncertainty). log g 1.79 from the mass and radius.

**Color.** A Planck spectrum at 4,403 K, because pARAM fits an extinction A_V = 0.32 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,403 K and log g 1.79 (u1 0.801, u2 0.017): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
