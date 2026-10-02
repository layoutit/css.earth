# EPIC 206473544

## Sources

Its oscillations, recorded in K2 campaign 3, give 2.49 solar masses and 17.1 solar radii; APOGEE spectra give 5,061 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2624554562106697600, distance 4,474 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206473544 (K2 campaign 3): PARAM asteroseismic distance (pc) 4473.476562 (16th-84th percentiles 4324.53125-4677.96875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.494 ± 0.019 mas (26.1 standard errors), is not used. Radius 17.0561 +/- 0.7674 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206473544 (K2 campaign 3): PARAM radius (solar radii) 17.05609 (16th-84th percentiles 16.401779-17.936534), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.4881 +/- 0.246 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206473544 (K2 campaign 3): PARAM mass (solar masses) 2.488057 (16th-84th percentiles 2.285935-2.777936), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,061 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206473544: APOGEE DR17 effective temperature 5060.66 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Color.** A Planck spectrum at 5,061 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,061 K and log g 2.37 (u1 0.607, u2 0.162): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
