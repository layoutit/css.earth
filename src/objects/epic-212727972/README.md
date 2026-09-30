# EPIC 212727972

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.90 solar masses and 6.4 solar radii; APOGEE spectra give 5,280 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3625372621720050176, distance 5,088 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212727972 (K2 campaign 17): PARAM asteroseismic distance (pc) 5088.125 (16th-84th percentiles 4927.070312-5256.484375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.212 ± 0.033 mas (6.5 standard errors), is not used. Radius 6.4424 +/- 0.2623 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212727972 (K2 campaign 17): PARAM radius (solar radii) 6.442364 (16th-84th percentiles 6.189509-6.714062), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9034 +/- 0.0891 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212727972 (K2 campaign 17): PARAM mass (solar masses) 0.903433 (16th-84th percentiles 0.819535-0.997637), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,280 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212727972: APOGEE DR17 effective temperature 5280.49 +/- 96 K (the catalogue's final uncertainty). log g 2.78 from the mass and radius.

**Colour.** A Planck spectrum at 5,280 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffeada. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,280 K and log g 2.78 (u1 0.552, u2 0.201): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
