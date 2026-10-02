# EPIC 201418291

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.08 solar masses and 11.1 solar radii; APOGEE spectra give 4,927 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3695151546629486336, distance 4,967 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201418291 (K2 campaign 10): PARAM asteroseismic distance (pc) 4966.679688 (16th-84th percentiles 4868.632812-5100.273438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.181 ± 0.019 mas (9.7 standard errors), is not used. Radius 11.1293 +/- 0.4152 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201418291 (K2 campaign 10): PARAM radius (solar radii) 11.129307 (16th-84th percentiles 10.744291-11.5746), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0767 +/- 0.0995 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201418291 (K2 campaign 10): PARAM mass (solar masses) 1.076687 (16th-84th percentiles 0.984906-1.183873), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,927 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201418291: APOGEE DR17 effective temperature 4926.5693 +/- 50 K (the catalogue's final uncertainty). log g 2.38 from the mass and radius.

**Color.** A Planck spectrum at 4,927 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,927 K and log g 2.38 (u1 0.645, u2 0.136): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
