# EPIC 248790186

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.94 solar masses and 5.8 solar radii; APOGEE spectra give 4,933 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3876445788389421312, distance 4,589 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248790186 (K2 campaign 14): PARAM asteroseismic distance (pc) 4589.101562 (16th-84th percentiles 4447.851562-4736.484375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.197 ± 0.036 mas (5.5 standard errors), is not used. Radius 5.8342 +/- 0.2201 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248790186 (K2 campaign 14): PARAM radius (solar radii) 5.834226 (16th-84th percentiles 5.622836-6.063052), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.939 +/- 0.0834 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248790186 (K2 campaign 14): PARAM mass (solar masses) 0.938964 (16th-84th percentiles 0.860552-1.027335), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,933 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248790186: APOGEE DR17 effective temperature 4932.532 +/- 50 K (the catalogue's final uncertainty). log g 2.88 from the mass and radius.

**Color.** A Planck spectrum at 4,933 K, because pARAM fits an extinction A_V = 0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,933 K and log g 2.88 (u1 0.650, u2 0.132): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
