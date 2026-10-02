# EPIC 229045701

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.53 solar masses and 10.3 solar radii; APOGEE spectra give 4,828 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3695712709876702976, distance 5,232 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229045701 (K2 campaign 10): PARAM asteroseismic distance (pc) 5231.640625 (16th-84th percentiles 5056.992188-5405.859375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.192 ± 0.020 mas (9.5 standard errors), is not used. Radius 10.331 +/- 0.4089 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229045701 (K2 campaign 10): PARAM radius (solar radii) 10.331004 (16th-84th percentiles 9.904328-10.722109), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.5255 +/- 0.1366 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229045701 (K2 campaign 10): PARAM mass (solar masses) 1.525516 (16th-84th percentiles 1.381942-1.655093), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,828 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229045701: APOGEE DR17 effective temperature 4828.338 +/- 50 K (the catalogue's final uncertainty). log g 2.59 from the mass and radius.

**Color.** A Planck spectrum at 4,828 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,828 K and log g 2.59 (u1 0.677, u2 0.112): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
