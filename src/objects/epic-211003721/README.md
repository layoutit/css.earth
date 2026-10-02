# EPIC 211003721

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.96 solar masses and 10.1 solar radii; APOGEE spectra give 4,425 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 67859319342089856, distance 1,562 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211003721 (K2 campaign 4): PARAM asteroseismic distance (pc) 1561.523438 (16th-84th percentiles 1532.167969-1600.9375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.533 ± 0.021 mas (25.3 standard errors), is not used. Radius 10.0675 +/- 0.3308 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211003721 (K2 campaign 4): PARAM radius (solar radii) 10.067535 (16th-84th percentiles 9.802754-10.464355), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.957 +/- 0.0735 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211003721 (K2 campaign 4): PARAM mass (solar masses) 0.95703 (16th-84th percentiles 0.899784-1.046812), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,425 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211003721: APOGEE DR17 effective temperature 4424.5645 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Color.** A Planck spectrum at 4,425 K, because pARAM fits an extinction A_V = 1.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,425 K and log g 2.41 (u1 0.802, u2 0.015): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
