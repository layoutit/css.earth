# EPIC 212586564

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.87 solar masses and 10.5 solar radii; APOGEE spectra give 5,052 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3616725478163763968, distance 4,491 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212586564 (K2 campaign 6): PARAM asteroseismic distance (pc) 4491.367188 (16th-84th percentiles 4396.679688-4588.398438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.232 ± 0.019 mas (12.2 standard errors), is not used. Radius 10.4675 +/- 0.3501 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212586564 (K2 campaign 6): PARAM radius (solar radii) 10.467512 (16th-84th percentiles 10.133325-10.833426), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8665 +/- 0.0748 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212586564 (K2 campaign 6): PARAM mass (solar masses) 0.866525 (16th-84th percentiles 0.797528-0.947096), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,052 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212586564: APOGEE DR17 effective temperature 5052.255999999999 +/- 90 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Colour.** A Planck spectrum at 5,052 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,052 K and log g 2.34 (u1 0.609, u2 0.161): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
