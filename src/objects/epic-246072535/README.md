# EPIC 246072535

## Sources

Its oscillations, recorded in K2 campaign 12, give 1.10 solar masses and 10.3 solar radii; APOGEE spectra give 4,760 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2442169050760322048, distance 3,169 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246072535 (K2 campaign 12): PARAM asteroseismic distance (pc) 3169.179688 (16th-84th percentiles 3073.085938-3276.953125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.285 ± 0.017 mas (17.1 standard errors), is not used. Radius 10.3365 +/- 0.4249 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246072535 (K2 campaign 12): PARAM radius (solar radii) 10.33647 (16th-84th percentiles 9.955033-10.804869), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1044 +/- 0.1082 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246072535 (K2 campaign 12): PARAM mass (solar masses) 1.104399 (16th-84th percentiles 1.012876-1.229367), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,760 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246072535: APOGEE DR17 effective temperature 4759.581 +/- 50 K (the catalogue's final uncertainty). log g 2.45 from the mass and radius.

**Color.** A Planck spectrum at 4,760 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,760 K and log g 2.45 (u1 0.695, u2 0.099): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
