# EPIC 211915593

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.11 solar masses and 10.5 solar radii; APOGEE spectra give 4,870 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 661004645201152896, distance 4,361 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211915593 (K2 campaign 5): PARAM asteroseismic distance (pc) 4361.445312 (16th-84th percentiles 4307.34375-4418.242188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.166 ± 0.021 mas (7.8 standard errors), is not used. Radius 10.5187 +/- 0.3427 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211915593 (K2 campaign 5): PARAM radius (solar radii) 10.518743 (16th-84th percentiles 10.332439-11.017838), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1126 +/- 0.0909 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211915593 (K2 campaign 5): PARAM mass (solar masses) 1.112567 (16th-84th percentiles 1.053053-1.234945), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,870 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211915593: APOGEE DR17 effective temperature 4869.559 +/- 50 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Color.** A Planck spectrum at 4,870 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,870 K and log g 2.44 (u1 0.662, u2 0.123): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
