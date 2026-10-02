# EPIC 248863593

## Sources

Its oscillations, recorded in K2 campaign 14, give 1.32 solar masses and 14.5 solar radii; APOGEE spectra give 4,965 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3883071862070482560, distance 3,846 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248863593 (K2 campaign 14): PARAM asteroseismic distance (pc) 3846.367188 (16th-84th percentiles 3690.859375-4009.296875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.289 ± 0.020 mas (14.5 standard errors), is not used. Radius 14.511 +/- 0.843 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248863593 (K2 campaign 14): PARAM radius (solar radii) 14.510982 (16th-84th percentiles 13.69366-15.379694), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.3202 +/- 0.1765 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248863593 (K2 campaign 14): PARAM mass (solar masses) 1.320169 (16th-84th percentiles 1.156082-1.509017), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,965 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248863593: APOGEE DR17 effective temperature 4965.1816 +/- 50 K (the catalogue's final uncertainty). log g 2.24 from the mass and radius.

**Color.** A Planck spectrum at 4,965 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,965 K and log g 2.24 (u1 0.632, u2 0.145): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
