# TIC 350344410

## Sources

Its oscillations, recorded by TESS, give 1.97 solar masses and 19.0 solar radii; APOGEE spectra give 4,600 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4759773608871910144, distance 1,017 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 350344410 (observed by TESS): PARAM asteroseismic distance (pc) 1016.660156 (16th-84th percentiles 1004.277344-1029.140625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.935 ± 0.029 mas (32.3 standard errors), is not used. Radius 19.0411 +/- 0.375 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 350344410 (observed by TESS): PARAM radius (solar radii) 19.041111 (16th-84th percentiles 18.634011-19.383925), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.9666 +/- 0.108 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 350344410 (observed by TESS): PARAM mass (solar masses) 1.966551 (16th-84th percentiles 1.849538-2.065453), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,600 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 350344410: APOGEE DR17 effective temperature 4599.8335 +/- 50 K (the catalogue's final uncertainty). log g 2.17 from the mass and radius.

**Color.** A Planck spectrum at 4,600 K, because pARAM fits an extinction A_V = 0.34 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,600 K and log g 2.17 (u1 0.742, u2 0.063): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
