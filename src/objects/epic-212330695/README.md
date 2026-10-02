# EPIC 212330695

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.73 solar masses and 10.2 solar radii; APOGEE spectra give 4,925 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6295314508425261952, distance 3,779 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212330695 (K2 campaign 6): PARAM asteroseismic distance (pc) 3779.414062 (16th-84th percentiles 3721.5625-3843.789062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.204 ± 0.019 mas (10.9 standard errors), is not used. Radius 10.1868 +/- 0.2355 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212330695 (K2 campaign 6): PARAM radius (solar radii) 10.186837 (16th-84th percentiles 9.998886-10.469848), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7341 +/- 0.0358 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212330695 (K2 campaign 6): PARAM mass (solar masses) 0.7341 (16th-84th percentiles 0.710144-0.781816), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,925 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212330695: APOGEE DR17 effective temperature 4924.62 +/- 50 K (the catalogue's final uncertainty). log g 2.29 from the mass and radius.

**Color.** A Planck spectrum at 4,925 K, because pARAM fits an extinction A_V = 0.24 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,925 K and log g 2.29 (u1 0.644, u2 0.136): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
