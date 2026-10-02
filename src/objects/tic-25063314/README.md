# TIC 25063314

## Sources

Its oscillations, recorded by TESS, give 0.79 solar masses and 20.1 solar radii; APOGEE spectra give 4,422 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4665942042471621248, distance 1,010 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 25063314 (observed by TESS): PARAM asteroseismic distance (pc) 1010.224609 (16th-84th percentiles 999.902344-1022.324219), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.898 ± 0.011 mas (84.2 standard errors), is not used. Radius 20.0983 +/- 0.3738 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 25063314 (observed by TESS): PARAM radius (solar radii) 20.098263 (16th-84th percentiles 19.830372-20.577993), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7949 +/- 0.0427 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 25063314 (observed by TESS): PARAM mass (solar masses) 0.794931 (16th-84th percentiles 0.764515-0.84999), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,422 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 25063314: APOGEE DR17 effective temperature 4421.9326 +/- 50 K (the catalogue's final uncertainty). log g 1.73 from the mass and radius.

**Color.** A Planck spectrum at 4,422 K, because pARAM fits an extinction A_V = 0.39 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,422 K and log g 1.73 (u1 0.794, u2 0.023): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
