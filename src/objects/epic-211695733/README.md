# EPIC 211695733

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.85 solar masses and 13.6 solar radii; APOGEE spectra give 4,494 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 607814941277727488, distance 2,952 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211695733 (K2 campaign 16): PARAM asteroseismic distance (pc) 2951.992188 (16th-84th percentiles 2896.015625-3023.476562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.294 ± 0.018 mas (16.2 standard errors), is not used. Radius 13.597 +/- 0.432 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211695733 (K2 campaign 16): PARAM radius (solar radii) 13.596989 (16th-84th percentiles 13.262207-14.126201), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8454 +/- 0.0591 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211695733 (K2 campaign 16): PARAM mass (solar masses) 0.845375 (16th-84th percentiles 0.803685-0.921953), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,494 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211695733: APOGEE DR17 effective temperature 4494.0625 +/- 50 K (the catalogue's final uncertainty). log g 2.1 from the mass and radius.

**Color.** A Planck spectrum at 4,494 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,494 K and log g 2.1 (u1 0.774, u2 0.039): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
