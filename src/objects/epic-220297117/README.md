# EPIC 220297117

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.76 solar masses and 10.9 solar radii; APOGEE spectra give 4,999 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2550369657883109504, distance 3,993 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220297117 (K2 campaign 8): PARAM asteroseismic distance (pc) 3992.96875 (16th-84th percentiles 3919.0625-4089.453125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.172 ± 0.016 mas (10.9 standard errors), is not used. Radius 10.9434 +/- 0.4306 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220297117 (K2 campaign 8): PARAM radius (solar radii) 10.943394 (16th-84th percentiles 10.623818-11.485024), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7597 +/- 0.0696 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220297117 (K2 campaign 8): PARAM mass (solar masses) 0.759672 (16th-84th percentiles 0.713244-0.852426), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,999 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220297117: APOGEE DR17 effective temperature 4998.505999999999 +/- 50 K (the catalogue's final uncertainty). log g 2.24 from the mass and radius.

**Color.** A Planck spectrum at 4,999 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,999 K and log g 2.24 (u1 0.622, u2 0.152): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
