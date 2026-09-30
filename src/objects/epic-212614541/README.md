# EPIC 212614541

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.87 solar masses and 12.6 solar radii; APOGEE spectra give 4,820 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3614790578217034624, distance 3,482 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212614541 (K2 campaign 6): PARAM asteroseismic distance (pc) 3482.148438 (16th-84th percentiles 3337.03125-3655.742188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.254 ± 0.016 mas (15.8 standard errors), is not used. Radius 12.5745 +/- 0.7312 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212614541 (K2 campaign 6): PARAM radius (solar radii) 12.574518 (16th-84th percentiles 11.940911-13.403387), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8712 +/- 0.1222 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212614541 (K2 campaign 6): PARAM mass (solar masses) 0.871158 (16th-84th percentiles 0.77193-1.016271), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,820 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212614541: APOGEE DR17 effective temperature 4820.2393 +/- 50 K (the catalogue's final uncertainty). log g 2.18 from the mass and radius.

**Colour.** A Planck spectrum at 4,820 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,820 K and log g 2.18 (u1 0.674, u2 0.114): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
