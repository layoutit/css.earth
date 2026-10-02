# TIC 382045827

## Sources

Its oscillations, recorded by TESS, give 0.94 solar masses and 12.5 solar radii; APOGEE spectra give 4,628 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4762684943863633920, distance 1,272 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 382045827 (observed by TESS): PARAM asteroseismic distance (pc) 1272.138672 (16th-84th percentiles 1245.830078-1299.082031), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.710 ± 0.012 mas (58.9 standard errors), is not used. Radius 12.4515 +/- 0.4039 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 382045827 (observed by TESS): PARAM radius (solar radii) 12.451516 (16th-84th percentiles 12.063388-12.871214), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9384 +/- 0.0845 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 382045827 (observed by TESS): PARAM mass (solar masses) 0.938409 (16th-84th percentiles 0.859638-1.028676), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,628 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 382045827: APOGEE DR17 effective temperature 4627.845 +/- 50 K (the catalogue's final uncertainty). log g 2.22 from the mass and radius.

**Color.** A Planck spectrum at 4,628 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,628 K and log g 2.22 (u1 0.734, u2 0.069): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
