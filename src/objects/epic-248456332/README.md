# EPIC 248456332

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.90 solar masses and 9.9 solar radii; APOGEE spectra give 5,014 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3855678354498241152, distance 3,768 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248456332 (K2 campaign 14): PARAM asteroseismic distance (pc) 3768.085938 (16th-84th percentiles 3688.203125-3842.8125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.246 ± 0.018 mas (13.8 standard errors), is not used. Radius 9.9296 +/- 0.3261 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248456332 (K2 campaign 14): PARAM radius (solar radii) 9.929632 (16th-84th percentiles 9.60535-10.257607), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8992 +/- 0.0721 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248456332 (K2 campaign 14): PARAM mass (solar masses) 0.89915 (16th-84th percentiles 0.827614-0.971745), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,014 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248456332: APOGEE DR17 effective temperature 5014.082 +/- 50 K (the catalogue's final uncertainty). log g 2.4 from the mass and radius.

**Color.** A Planck spectrum at 5,014 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,014 K and log g 2.4 (u1 0.620, u2 0.154): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
