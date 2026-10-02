# EPIC 248863417

## Sources

Its oscillations, recorded in K2 campaign 14, give 1.11 solar masses and 10.4 solar radii; APOGEE spectra give 4,912 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3871660541987067008, distance 2,421 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248863417 (K2 campaign 14): PARAM asteroseismic distance (pc) 2420.761719 (16th-84th percentiles 2391.660156-2454.003906), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.387 ± 0.014 mas (27.8 standard errors), is not used. Radius 10.4246 +/- 0.266 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248863417 (K2 campaign 14): PARAM radius (solar radii) 10.424574 (16th-84th percentiles 10.257201-10.789168), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1093 +/- 0.0759 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248863417 (K2 campaign 14): PARAM mass (solar masses) 1.109264 (16th-84th percentiles 1.048208-1.200074), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,912 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248863417: APOGEE DR17 effective temperature 4911.584 +/- 50 K (the catalogue's final uncertainty). log g 2.45 from the mass and radius.

**Color.** A Planck spectrum at 4,912 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,912 K and log g 2.45 (u1 0.650, u2 0.132): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
