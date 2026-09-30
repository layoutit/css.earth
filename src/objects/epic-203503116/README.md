# EPIC 203503116

## Sources

Its oscillations, recorded in K2 campaign 2, give 0.89 solar masses and 17.0 solar radii; APOGEE spectra give 4,225 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6048674671427298688, distance 4,332 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203503116 (K2 campaign 2): PARAM asteroseismic distance (pc) 4331.796875 (16th-84th percentiles 4252.148438-4425.429688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.185 ± 0.031 mas (6.0 standard errors), is not used. Radius 16.9631 +/- 0.4637 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203503116 (K2 campaign 2): PARAM radius (solar radii) 16.96314 (16th-84th percentiles 16.591411-17.518841), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8939 +/- 0.0482 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203503116 (K2 campaign 2): PARAM mass (solar masses) 0.893856 (16th-84th percentiles 0.861707-0.958114), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,225 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203503116: APOGEE DR17 effective temperature 4224.8516 +/- 50 K (the catalogue's final uncertainty). log g 1.93 from the mass and radius.

**Colour.** A Planck spectrum at 4,225 K, because pARAM fits an extinction A_V = 1.93 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffd8b0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,225 K and log g 1.93 (u1 0.862, u2 -0.033): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
