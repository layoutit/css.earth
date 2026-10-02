# EPIC 211579059

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.81 solar masses and 10.1 solar radii; APOGEE spectra give 5,117 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 606990689808922240, distance 6,411 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211579059 (K2 campaign 5): PARAM asteroseismic distance (pc) 6410.625 (16th-84th percentiles 6181.640625-6681.40625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.102 ± 0.025 mas (4.1 standard errors), is not used. Radius 10.0731 +/- 0.5219 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211579059 (K2 campaign 5): PARAM radius (solar radii) 10.073085 (16th-84th percentiles 9.618192-10.661971), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8096 +/- 0.0984 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211579059 (K2 campaign 5): PARAM mass (solar masses) 0.809582 (16th-84th percentiles 0.726738-0.923455), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,117 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211579059: APOGEE DR17 effective temperature 5117.009 +/- 73 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Color.** A Planck spectrum at 5,117 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,117 K and log g 2.34 (u1 0.592, u2 0.172): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
