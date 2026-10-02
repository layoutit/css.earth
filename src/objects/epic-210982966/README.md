# EPIC 210982966

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.16 solar masses and 10.5 solar radii; APOGEE spectra give 4,955 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 61834614097882752, distance 2,216 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210982966 (K2 campaign 4): PARAM asteroseismic distance (pc) 2215.625 (16th-84th percentiles 2190.703125-2240.957031), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.431 ± 0.017 mas (25.6 standard errors), is not used. Radius 10.4987 +/- 0.1786 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210982966 (K2 campaign 4): PARAM radius (solar radii) 10.498733 (16th-84th percentiles 10.330794-10.687953), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.156 +/- 0.0609 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210982966 (K2 campaign 4): PARAM mass (solar masses) 1.155991 (16th-84th percentiles 1.095101-1.216906), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,955 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210982966: APOGEE DR17 effective temperature 4955.417 +/- 50 K (the catalogue's final uncertainty). log g 2.46 from the mass and radius.

**Color.** A Planck spectrum at 4,955 K, because pARAM fits an extinction A_V = 0.88 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,955 K and log g 2.46 (u1 0.637, u2 0.141): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
