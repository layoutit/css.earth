# EPIC 247532456

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.67 solar masses and 21.1 solar radii; APOGEE spectra give 4,594 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3418249198261842560, distance 5,246 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247532456 (K2 campaign 13): PARAM asteroseismic distance (pc) 5245.546875 (16th-84th percentiles 4987.773438-5480.46875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.145 ± 0.021 mas (7.0 standard errors), is not used. Radius 21.093 +/- 1.273 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247532456 (K2 campaign 13): PARAM radius (solar radii) 21.092968 (16th-84th percentiles 19.793055-22.339069), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.6726 +/- 0.2166 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247532456 (K2 campaign 13): PARAM mass (solar masses) 1.672586 (16th-84th percentiles 1.4571-1.890355), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,594 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247532456: APOGEE DR17 effective temperature 4593.7495 +/- 50 K (the catalogue's final uncertainty). log g 2.01 from the mass and radius.

**Color.** A Planck spectrum at 4,594 K, because pARAM fits an extinction A_V = 1.27 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,594 K and log g 2.01 (u1 0.741, u2 0.064): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
