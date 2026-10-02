# EPIC 220311188

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.82 solar masses and 9.7 solar radii; APOGEE spectra give 4,633 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2538802761198920064, distance 3,405 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220311188 (K2 campaign 8): PARAM asteroseismic distance (pc) 3404.453125 (16th-84th percentiles 3353.320312-3463.828125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.220 ± 0.018 mas (12.1 standard errors), is not used. Radius 9.6655 +/- 0.2089 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220311188 (K2 campaign 8): PARAM radius (solar radii) 9.665497 (16th-84th percentiles 9.499834-9.91767), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8227 +/- 0.0391 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220311188 (K2 campaign 8): PARAM mass (solar masses) 0.822681 (16th-84th percentiles 0.795553-0.873826), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,633 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220311188: APOGEE DR17 effective temperature 4632.8203 +/- 50 K (the catalogue's final uncertainty). log g 2.38 from the mass and radius.

**Color.** A Planck spectrum at 4,633 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,633 K and log g 2.38 (u1 0.735, u2 0.068): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
