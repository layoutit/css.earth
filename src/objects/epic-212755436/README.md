# EPIC 212755436

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.98 solar masses and 7.1 solar radii; APOGEE spectra give 5,010 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3628485751455087232, distance 3,754 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212755436 (K2 campaign 17): PARAM asteroseismic distance (pc) 3753.476562 (16th-84th percentiles 3627.421875-3883.085938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.239 ± 0.022 mas (10.7 standard errors), is not used. Radius 7.1179 +/- 0.3093 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212755436 (K2 campaign 17): PARAM radius (solar radii) 7.117893 (16th-84th percentiles 6.816204-7.434766), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9846 +/- 0.0995 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212755436 (K2 campaign 17): PARAM mass (solar masses) 0.984613 (16th-84th percentiles 0.889868-1.088787), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,010 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212755436: APOGEE DR17 effective temperature 5009.9756 +/- 50 K (the catalogue's final uncertainty). log g 2.73 from the mass and radius.

**Color.** A Planck spectrum at 5,010 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,010 K and log g 2.73 (u1 0.625, u2 0.150): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
