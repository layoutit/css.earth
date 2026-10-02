# EPIC 212285353

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.00 solar masses and 10.3 solar radii; APOGEE spectra give 4,957 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6294130884158194304, distance 3,487 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212285353 (K2 campaign 6): PARAM asteroseismic distance (pc) 3487.265625 (16th-84th percentiles 3433.28125-3584.84375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.231 ± 0.017 mas (13.2 standard errors), is not used. Radius 10.347 +/- 0.4834 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212285353 (K2 campaign 6): PARAM radius (solar radii) 10.347027 (16th-84th percentiles 10.078462-11.045299), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9987 +/- 0.1004 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212285353 (K2 campaign 6): PARAM mass (solar masses) 0.998706 (16th-84th percentiles 0.942003-1.142823), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,957 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212285353: APOGEE DR17 effective temperature 4956.734 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Color.** A Planck spectrum at 4,957 K, because pARAM fits an extinction A_V = 0.29 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,957 K and log g 2.41 (u1 0.636, u2 0.142): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
