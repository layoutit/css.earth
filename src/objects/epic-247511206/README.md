# EPIC 247511206

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.12 solar masses and 15.9 solar radii; APOGEE spectra give 4,539 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3415260034166574208, distance 6,515 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247511206 (K2 campaign 13): PARAM asteroseismic distance (pc) 6514.765625 (16th-84th percentiles 6226.09375-6820.390625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.147 ± 0.029 mas (5.0 standard errors), is not used. Radius 15.9057 +/- 0.9561 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247511206 (K2 campaign 13): PARAM radius (solar radii) 15.905747 (16th-84th percentiles 14.98689-16.899071), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1234 +/- 0.153 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247511206 (K2 campaign 13): PARAM mass (solar masses) 1.12343 (16th-84th percentiles 0.981509-1.287592), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,539 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247511206: APOGEE DR17 effective temperature 4539.4595 +/- 50 K (the catalogue's final uncertainty). log g 2.09 from the mass and radius.

**Colour.** A Planck spectrum at 4,539 K, because pARAM fits an extinction A_V = 1.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,539 K and log g 2.09 (u1 0.760, u2 0.050): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
