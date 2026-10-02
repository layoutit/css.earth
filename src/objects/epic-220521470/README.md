# EPIC 220521470

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.91 solar masses and 12.6 solar radii; APOGEE spectra give 4,486 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2566489529138108800, distance 1,659 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220521470 (K2 campaign 8): PARAM asteroseismic distance (pc) 1659.082031 (16th-84th percentiles 1610.566406-1717.65625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.605 ± 0.029 mas (20.8 standard errors), is not used. Radius 12.5544 +/- 0.5234 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220521470 (K2 campaign 8): PARAM radius (solar radii) 12.554357 (16th-84th percentiles 12.100714-13.147443), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9072 +/- 0.0885 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220521470 (K2 campaign 8): PARAM mass (solar masses) 0.907172 (16th-84th percentiles 0.832853-1.009832), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,486 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220521470: APOGEE DR17 effective temperature 4485.9277 +/- 50 K (the catalogue's final uncertainty). log g 2.2 from the mass and radius.

**Color.** A Planck spectrum at 4,486 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,486 K and log g 2.2 (u1 0.779, u2 0.035): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
