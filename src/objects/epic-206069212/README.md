# EPIC 206069212

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.84 solar masses and 7.6 solar radii; APOGEE spectra give 4,695 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6840666670869140736, distance 2,554 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206069212 (K2 campaign 3): PARAM asteroseismic distance (pc) 2554.21875 (16th-84th percentiles 2518.945312-2595.390625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.324 ± 0.018 mas (18.2 standard errors), is not used. Radius 7.6111 +/- 0.1542 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206069212 (K2 campaign 3): PARAM radius (solar radii) 7.611071 (16th-84th percentiles 7.494253-7.802704), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8387 +/- 0.0406 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206069212 (K2 campaign 3): PARAM mass (solar masses) 0.838713 (16th-84th percentiles 0.811133-0.892342), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,695 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206069212: APOGEE DR17 effective temperature 4694.5566 +/- 50 K (the catalogue's final uncertainty). log g 2.6 from the mass and radius.

**Colour.** A Planck spectrum at 4,695 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,695 K and log g 2.6 (u1 0.718, u2 0.081): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
