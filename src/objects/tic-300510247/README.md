# TIC 300510247

## Sources

Its oscillations, recorded by TESS, give 0.89 solar masses and 19.6 solar radii; APOGEE spectra give 4,414 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5267562747555988480, distance 1,256 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 300510247 (observed by TESS): PARAM asteroseismic distance (pc) 1255.664062 (16th-84th percentiles 1228.349609-1285.175781), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.809 ± 0.010 mas (80.5 standard errors), is not used. Radius 19.5773 +/- 0.6797 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 300510247 (observed by TESS): PARAM radius (solar radii) 19.577344 (16th-84th percentiles 18.955437-20.314807), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8931 +/- 0.0882 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 300510247 (observed by TESS): PARAM mass (solar masses) 0.893119 (16th-84th percentiles 0.815587-0.992081), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,414 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 300510247: APOGEE DR17 effective temperature 4414.136 +/- 50 K (the catalogue's final uncertainty). log g 1.81 from the mass and radius.

**Color.** A Planck spectrum at 4,414 K, because pARAM fits an extinction A_V = 0.74 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,414 K and log g 1.81 (u1 0.798, u2 0.020): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
