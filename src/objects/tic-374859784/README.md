# TIC 374859784

## Sources

Its oscillations, recorded by TESS, give 1.07 solar masses and 22.0 solar radii; APOGEE spectra give 4,414 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4758725258895312896, distance 1,820 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 374859784 (observed by TESS): PARAM asteroseismic distance (pc) 1820.273438 (16th-84th percentiles 1754.648438-1881.894531), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.581 ± 0.010 mas (57.3 standard errors), is not used. Radius 22.0474 +/- 1.0054 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 374859784 (observed by TESS): PARAM radius (solar radii) 22.047446 (16th-84th percentiles 21.032972-23.043856), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0715 +/- 0.1253 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 374859784 (observed by TESS): PARAM mass (solar masses) 1.071465 (16th-84th percentiles 0.946775-1.197326), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,414 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 374859784: APOGEE DR17 effective temperature 4413.734 +/- 50 K (the catalogue's final uncertainty). log g 1.78 from the mass and radius.

**Color.** A Planck spectrum at 4,414 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,414 K and log g 1.78 (u1 0.798, u2 0.020): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
