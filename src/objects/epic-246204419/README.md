# EPIC 246204419

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.91 solar masses and 11.1 solar radii; APOGEE spectra give 4,892 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2632911026572156032, distance 5,562 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246204419 (K2 campaign 12): PARAM asteroseismic distance (pc) 5562.03125 (16th-84th percentiles 5315.703125-5814.453125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.117 ± 0.025 mas (4.7 standard errors), is not used. Radius 11.074 +/- 0.6053 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246204419 (K2 campaign 12): PARAM radius (solar radii) 11.073999 (16th-84th percentiles 10.486135-11.696678), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9069 +/- 0.1153 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246204419 (K2 campaign 12): PARAM mass (solar masses) 0.906863 (16th-84th percentiles 0.798212-1.028823), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,892 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246204419: APOGEE DR17 effective temperature 4892.2783 +/- 50 K (the catalogue's final uncertainty). log g 2.31 from the mass and radius.

**Colour.** A Planck spectrum at 4,892 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,892 K and log g 2.31 (u1 0.654, u2 0.129): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
