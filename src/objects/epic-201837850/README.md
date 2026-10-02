# EPIC 201837850

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.98 solar masses and 11.3 solar radii; APOGEE spectra give 4,827 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3898995814098536448, distance 4,508 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201837850 (K2 campaign 1): PARAM asteroseismic distance (pc) 4507.929688 (16th-84th percentiles 4396.523438-4622.5), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.180 ± 0.021 mas (8.5 standard errors), is not used. Radius 11.2809 +/- 0.4028 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201837850 (K2 campaign 1): PARAM radius (solar radii) 11.280856 (16th-84th percentiles 10.882997-11.688597), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9844 +/- 0.0864 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201837850 (K2 campaign 1): PARAM mass (solar masses) 0.984432 (16th-84th percentiles 0.901134-1.073922), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,827 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201837850: APOGEE DR17 effective temperature 4826.774 +/- 50 K (the catalogue's final uncertainty). log g 2.33 from the mass and radius.

**Color.** A Planck spectrum at 4,827 K, because pARAM fits an extinction A_V = -0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,827 K and log g 2.33 (u1 0.674, u2 0.115): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
