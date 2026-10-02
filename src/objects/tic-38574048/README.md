# TIC 38574048

## Sources

Its oscillations, recorded by TESS, give 1.05 solar masses and 18.1 solar radii; APOGEE spectra give 4,327 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4676853836385056128, distance 1,544 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38574048 (observed by TESS): PARAM asteroseismic distance (pc) 1543.886719 (16th-84th percentiles 1509.472656-1578.144531), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.707 ± 0.012 mas (61.2 standard errors), is not used. Radius 18.1131 +/- 0.644 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38574048 (observed by TESS): PARAM radius (solar radii) 18.113093 (16th-84th percentiles 17.466355-18.754444), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0545 +/- 0.1064 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38574048 (observed by TESS): PARAM mass (solar masses) 1.05449 (16th-84th percentiles 0.951909-1.164697), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,327 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38574048: APOGEE DR17 effective temperature 4327.2046 +/- 50 K (the catalogue's final uncertainty). log g 1.95 from the mass and radius.

**Color.** A Planck spectrum at 4,327 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdab4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,327 K and log g 1.95 (u1 0.828, u2 -0.005): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
