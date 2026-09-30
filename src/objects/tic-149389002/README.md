# TIC 149389002

## Sources

Its oscillations, recorded by TESS, give 1.41 solar masses and 13.8 solar radii; APOGEE spectra give 4,926 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4756957102462305152, distance 1,249 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149389002 (observed by TESS): PARAM asteroseismic distance (pc) 1248.867188 (16th-84th percentiles 1230.605469-1265.839844), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.958 ± 0.013 mas (72.7 standard errors), is not used. Radius 13.7786 +/- 0.4267 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149389002 (observed by TESS): PARAM radius (solar radii) 13.778566 (16th-84th percentiles 13.262211-14.115693), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4149 +/- 0.108 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149389002 (observed by TESS): PARAM mass (solar masses) 1.414876 (16th-84th percentiles 1.300116-1.516115), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,926 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149389002: APOGEE DR17 effective temperature 4925.7 +/- 50 K (the catalogue's final uncertainty). log g 2.31 from the mass and radius.

**Colour.** A Planck spectrum at 4,926 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,926 K and log g 2.31 (u1 0.644, u2 0.136): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
